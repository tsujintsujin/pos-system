"use client";

/**
 * Report builder — editor shell.
 *
 * Holds one piece of report state: the `ReportConfig`. Every control writes back through
 * the helpers in lib/report-builder/config.ts, which re-normalise the whole object, so a
 * control never has to know what its edit invalidates elsewhere (switching data source
 * drops stale slots, switching visual type drops slots that no longer exist).
 *
 * The preview runs against live POS data through /api/report-builder/preview, debounced so
 * typing in a filter doesn't fire a query per keystroke.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Select from "@/app/components/ui/Select";
import { ChevronDownIcon } from "@/app/components/ui/icons";
import { apiPath } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { DATASETS, VISUALS, fieldsForSlot, getDataset, getField, type SlotSpec } from "@/lib/report-builder/catalog";
import {
  createDefaultConfig,
  newVisualId,
  normalizeConfig,
  setDataset,
  setSlot,
  setVisualType,
} from "@/lib/report-builder/config";
import {
  emptySnapshot,
  parsePublished,
  publishVisual,
  publishedSnapshot,
  subscribePublished,
} from "@/lib/report-builder/published";
import { validateConfig } from "@/lib/report-builder/validate";
import {
  AGGREGATION_LABELS,
  FILTER_OPERATOR_LABELS,
  VALUELESS_OPERATORS,
  type Aggregation,
  type FilterOperator,
  type ReportConfig,
  type ReportResult,
} from "@/lib/report-builder/types";
import ReportVisual from "./ReportVisual";
import ManageVisualsModal from "./ManageVisualsModal";

/**
 * The preview shows the dashboard's default window (this month so far), so what you build
 * is what you'll see once it's published. The dashboard's own date filter takes over from
 * there — a visual carries no dates of its own.
 */
function previewRange(): { from: string; to: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const to = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return { from: `${to.slice(0, 7)}-01`, to };
}

/** Which left-hand panel is expanded. One at a time keeps the column short enough to
 * scan without scrolling past the preview. */
type PanelKey = "data" | "visual" | "fields" | "filters";

const EMPTY_RESULT: ReportResult = { columns: [], rows: [], truncated: false };

export default function ReportBuilderClient() {
  const [config, setConfig] = useState<ReportConfig>(createDefaultConfig);
  // Results are stored with the config key that produced them. Without that pairing, the
  // previous visual's rows render against the new visual's slot mapping for one beat
  // after a change — a donut drawn from a line chart's date buckets, labelled "—".
  const [resultState, setResultState] = useState<{ key: string; result: ReportResult }>({
    key: "",
    result: EMPTY_RESULT,
  });
  const [loading, setLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [justPublished, setJustPublished] = useState(false);
  const [openPanel, setOpenPanel] = useState<PanelKey>("data");
  const [managing, setManaging] = useState(false);

  const dataset = getDataset(config.datasetId)!;
  const visual = VISUALS.find((v) => v.type === config.visualType)!;
  const validation = validateConfig(config);
  const errors = validation.issues.filter((i) => i.level === "error");
  const warnings = validation.issues.filter((i) => i.level === "warning");

  const boundLabels = visual.slots
    .map((slot) => config.slots[slot.name])
    .filter((id): id is string => Boolean(id))
    .map((id) => getField(dataset, id)?.label)
    .filter(Boolean);
  const fieldsSummary = boundLabels.length === 0 ? "Not set" : boundLabels.join(" · ");

  const metricFieldIds = visual.slots
    .map((slot) => config.slots[slot.name])
    .filter((id): id is string => Boolean(id))
    .filter((id) => getField(dataset, id)?.role === "metric");

  // Browser storage is an external store, so React subscribes to it directly rather than
  // mirroring it into state inside an effect. The snapshot is the raw JSON string, which
  // compares stably; the parsed list is derived.
  const published = parsePublished(
    useSyncExternalStore(subscribePublished, publishedSnapshot, emptySnapshot),
  );

  // Debounced live preview. `configKey` rather than `config` as the dependency: the
  // normaliser returns a fresh object on every edit, so identity alone would refetch even
  // when nothing meaningful changed.
  const configKey = JSON.stringify({ ...config, name: undefined, id: undefined });
  const isValid = validation.valid;
  const latestRequest = useRef(0);

  useEffect(() => {
    if (!isValid) return;

    const requestId = latestRequest.current + 1;
    latestRequest.current = requestId;

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams({
          configs: JSON.stringify([JSON.parse(configKey)]),
          ...previewRange(),
        });
        const response = await fetch(apiPath(`/api/report-builder/preview?${query}`), {
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`Preview failed (${response.status})`);
        const data = (await response.json()) as { results: ReportResult[] };
        // A slower earlier request must not overwrite a newer result.
        if (latestRequest.current !== requestId) return;
        setResultState({ key: configKey, result: data.results[0] ?? EMPTY_RESULT });
        setQueryError(null);
      } catch (error) {
        if (latestRequest.current !== requestId) return;
        setResultState({ key: configKey, result: EMPTY_RESULT });
        setQueryError(error instanceof Error ? error.message : "Preview failed.");
      } finally {
        if (latestRequest.current === requestId) setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [configKey, isValid]);

  const isCurrent = resultState.key === configKey;
  const result = isCurrent ? resultState.result : EMPTY_RESULT;
  const alreadyPublished = published.some((v) => v.config.id === config.id);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* ---------------- Configuration ---------------- */}
      <div className="flex flex-col gap-4 lg:col-span-5 xl:col-span-4">
        <Panel
          panel="data"
          step="1"
          title="Data"
          summary={dataset.label}
          open={openPanel === "data"}
          onOpen={setOpenPanel}
        >
          <Select
            aria-label="Data"
            value={config.datasetId}
            onChange={(e) => setConfig(setDataset(config, e.target.value))}
          >
            {DATASETS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </Select>
          <p className="text-xs text-text-muted">{dataset.description}</p>
        </Panel>

        <Panel
          panel="visual"
          step="2"
          title="Visual Type"
          summary={visual.label}
          open={openPanel === "visual"}
          onOpen={setOpenPanel}
        >
          <div className="flex flex-wrap gap-1.5">
            {VISUALS.map((v) => {
              const active = v.type === config.visualType;
              return (
                <button
                  key={v.type}
                  type="button"
                  onClick={() => setConfig(setVisualType(config, v.type))}
                  aria-pressed={active}
                  className={cn(
                    "cursor-pointer rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors duration-150",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-text-muted hover:bg-bg hover:text-text",
                  )}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-text-muted">{visual.whenToUse}</p>
        </Panel>

        <Panel
          panel="fields"
          step="3"
          title="Fields"
          summary={fieldsSummary}
          open={openPanel === "fields"}
          onOpen={setOpenPanel}
        >
          {visual.slots.map((slot) => (
            <SlotEditor key={slot.name} slot={slot} config={config} onChange={setConfig} />
          ))}

          {metricFieldIds.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <p className="text-xs font-medium text-text">Aggregation</p>
              {metricFieldIds.map((fieldId) => {
                const field = getField(dataset, fieldId)!;
                return (
                  <label key={fieldId} className="flex items-center justify-between gap-2 text-xs text-text-muted">
                    <span className="truncate">{field.label}</span>
                    <Select
                      aria-label={`Aggregation for ${field.label}`}
                      className="w-40 shrink-0"
                      value={config.aggregations[fieldId] ?? "sum"}
                      onChange={(e) =>
                        setConfig(
                          normalizeConfig({
                            ...config,
                            aggregations: {
                              ...config.aggregations,
                              [fieldId]: e.target.value as Aggregation,
                            },
                          }),
                        )
                      }
                    >
                      {(field.aggregations ?? []).map((agg) => (
                        <option key={agg} value={agg}>
                          {AGGREGATION_LABELS[agg]}
                        </option>
                      ))}
                    </Select>
                  </label>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel
          panel="filters"
          step="4"
          title="Filters"
          summary={config.filters.length === 0 ? "None" : `${config.filters.length} applied`}
          open={openPanel === "filters"}
          onOpen={setOpenPanel}
        >
          <FiltersBody config={config} onChange={setConfig} />
        </Panel>
      </div>

      {/* ---------------- Preview and publishing ---------------- */}
      <div className="flex flex-col gap-4 lg:col-span-7 xl:col-span-8">
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="flex min-w-56 flex-1 flex-col gap-1 text-xs text-text-muted">
              Visual name
              <Input
                value={config.name}
                placeholder="e.g. Revenue by category"
                onChange={(e) => {
                  setJustPublished(false);
                  setConfig({ ...config, name: e.target.value });
                }}
              />
            </label>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setJustPublished(false);
                  setConfig({ ...createDefaultConfig(), id: newVisualId(), name: "" });
                }}
              >
                New
              </Button>
              <Button variant="secondary" onClick={() => setManaging(true)}>
                Manage
              </Button>
              <Button
                disabled={!validation.valid}
                onClick={() => {
                  publishVisual(config);
                  setJustPublished(true);
                }}
              >
                {alreadyPublished ? "Update on dashboard" : "Publish to dashboard"}
              </Button>
            </div>
          </div>
          {justPublished && (
            <p className="text-xs text-success">
              “{config.name}” is on the dashboard. Open Dashboard to see it in place.
            </p>
          )}
        </Card>

        <Card className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-heading text-base font-semibold text-text">Preview</h2>
            <p className="text-xs text-text-muted">
              {loading || !isCurrent ? "Loading…" : `This month · ${result.rows.length} group${result.rows.length === 1 ? "" : "s"}`}
            </p>
          </div>

          {errors.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-lg border border-warning-border bg-warning-bg p-3">
              <p className="text-sm font-medium text-warning">Finish the configuration to see a preview</p>
              <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-warning">
                {errors.map((issue, i) => (
                  <li key={i}>{issue.message}</li>
                ))}
              </ul>
            </div>
          ) : queryError ? (
            <div className="rounded-lg border border-danger-border bg-danger-bg p-3 text-sm text-danger">
              {queryError}
            </div>
          ) : (
            <ReportVisual config={config} result={result} pending={!isCurrent} expandedLimit={10} />
          )}

          {warnings.length > 0 && (
            <ul className="flex flex-col gap-1 text-xs text-text-muted">
              {warnings.map((issue, i) => (
                <li key={i}>• {issue.message}</li>
              ))}
            </ul>
          )}
        </Card>

      </div>
      {managing && <ManageVisualsModal onClose={() => setManaging(false)} />}
    </div>
  );
}

/**
 * One collapsible step in the left-hand column. Exactly one is open at a time: the four
 * steps are sequential, the column is narrow, and having all of them expanded pushed the
 * preview off-screen — which is the one thing you actually want to keep looking at.
 *
 * Collapsed panels still say what they hold (`summary`), so the column reads as a filled-in
 * form rather than four closed doors.
 */
function Panel({
  panel,
  step,
  title,
  summary,
  open,
  onOpen,
  children,
}: {
  panel: PanelKey;
  step: string;
  title: string;
  summary: string;
  open: boolean;
  onOpen: (panel: PanelKey) => void;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col overflow-hidden p-0">
      <button
        type="button"
        onClick={() => onOpen(panel)}
        aria-expanded={open}
        className={cn(
          "flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors duration-150",
          "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
          open ? "bg-bg" : "hover:bg-bg",
        )}
      >
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            open ? "bg-primary text-white" : "bg-bg text-text-muted",
          )}
        >
          {step}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold uppercase tracking-wide text-text">{title}</span>
          {!open && <span className="block truncate text-xs text-text-muted">{summary}</span>}
        </span>
        <ChevronDownIcon
          className={cn(
            "h-4 w-4 shrink-0 text-text-muted transition-transform duration-200",
            open ? "rotate-180" : "rotate-0",
          )}
        />
      </button>
      {open && <div className="flex flex-col gap-3 border-t border-border px-4 py-4">{children}</div>}
    </Card>
  );
}

/** One slot — a single-select of the fields whose role that slot accepts. */
function SlotEditor({
  slot,
  config,
  onChange,
}: {
  slot: SlotSpec;
  config: ReportConfig;
  onChange: (config: ReportConfig) => void;
}) {
  const dataset = getDataset(config.datasetId)!;
  const options = fieldsForSlot(dataset, slot);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-text">{slot.label}</span>
        {slot.required && <span className="text-xs text-danger">required</span>}
      </div>
      <Select
        aria-label={slot.label}
        value={config.slots[slot.name] ?? ""}
        onChange={(e) => onChange(setSlot(config, slot.name, e.target.value || null))}
      >
        <option value="">{slot.required ? "Choose a field…" : "None"}</option>
        {options.map((field) => (
          <option key={field.id} value={field.id}>
            {field.label}
          </option>
        ))}
      </Select>
      {slot.hint && <p className="text-xs text-text-muted">{slot.hint}</p>}
    </div>
  );
}

function FiltersBody({
  config,
  onChange,
}: {
  config: ReportConfig;
  onChange: (config: ReportConfig) => void;
}) {
  const dataset = getDataset(config.datasetId)!;

  const update = (id: string, patch: Partial<ReportConfig["filters"][number]>) =>
    onChange(
      normalizeConfig({
        ...config,
        filters: config.filters.map((f) => (f.id === id ? { ...f, ...patch } : f)),
      }),
    );

  return (
    <>
      {config.filters.length === 0 && (
        <p className="text-xs text-text-muted">
          No filters — every row in this data is included. The dashboard&rsquo;s date range still applies.
        </p>
      )}

      {config.filters.map((filter) => {
        const field = getField(dataset, filter.field);
        const needsValue = !VALUELESS_OPERATORS.has(filter.operator);
        return (
          <div key={filter.id} className="flex flex-col gap-2 rounded-lg border border-border p-2.5">
            <div className="flex gap-2">
              <Select
                aria-label="Filter field"
                className="flex-1"
                value={filter.field}
                onChange={(e) => update(filter.id, { field: e.target.value })}
              >
                {dataset.fields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </Select>
              <button
                type="button"
                aria-label="Remove filter"
                onClick={() =>
                  onChange(
                    normalizeConfig({ ...config, filters: config.filters.filter((f) => f.id !== filter.id) }),
                  )
                }
                className="cursor-pointer rounded-md border border-border px-2 text-sm text-text-muted transition-colors duration-150 hover:bg-bg hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                ×
              </button>
            </div>
            <div className="flex gap-2">
              <Select
                aria-label="Filter operator"
                className="w-40"
                value={filter.operator}
                onChange={(e) => update(filter.id, { operator: e.target.value as FilterOperator })}
              >
                {Object.entries(FILTER_OPERATOR_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              {needsValue && (
                <Input
                  aria-label="Filter value"
                  className="flex-1"
                  placeholder={field?.role === "date" ? "YYYY-MM-DD" : "Value"}
                  value={filter.value}
                  onChange={(e) => update(filter.id, { value: e.target.value })}
                />
              )}
            </div>
          </div>
        );
      })}

      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          onChange(
            normalizeConfig({
              ...config,
              filters: [
                ...config.filters,
                {
                  id: `f${config.filters.length + 1}-${Date.now().toString(36)}`,
                  field: dataset.fields[0].id,
                  operator: "eq",
                  value: "",
                },
              ],
            }),
          )
        }
      >
        Add filter
      </Button>
    </>
  );
}
