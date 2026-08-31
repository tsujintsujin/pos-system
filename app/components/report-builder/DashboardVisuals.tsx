"use client";

/**
 * Published report-builder visuals, rendered on the dashboard.
 *
 * Renders nothing at all when nothing has been published — an empty "your visuals" shelf
 * on the main dashboard would be permanent clutter for stores that never use the builder.
 *
 * Every visual is scoped by the dashboard's own date filter (`rangeKey`), which is why the
 * builder has no date controls of its own. All of them are fetched in a single request.
 */

import { useEffect, useState, useSyncExternalStore } from "react";
import Card from "@/app/components/ui/Card";
import { LinkButton } from "@/app/components/ui/Button";
import { apiPath } from "@/lib/base-path";
import { ChartBarIcon } from "@/app/components/ui/icons";
import { VISUALS, getDataset } from "@/lib/report-builder/catalog";
import {
  deleteVisual,
  emptySnapshot,
  parsePublished,
  publishedSnapshot,
  subscribePublished,
} from "@/lib/report-builder/published";
import { downloadResultCsv } from "@/lib/report-builder/export-csv";
import type { ReportResult, SortDirection } from "@/lib/report-builder/types";
import ReportVisual from "./ReportVisual";
import VisualMenu from "./VisualMenu";
import RenameVisualModal from "./RenameVisualModal";

const EMPTY_RESULT: ReportResult = { columns: [], rows: [], truncated: false };

export default function DashboardVisuals({
  fromStr,
  toStr,
}: {
  fromStr: string;
  toStr: string;
}) {
  // Paired with the snapshot they were fetched for: deleting a visual reorders the
  // array, and index-aligned results from the previous shape would land on the wrong
  // cards until the refetch returned.
  const [resultState, setResultState] = useState<{ key: string; results: ReportResult[] }>({
    key: "",
    results: [],
  });
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  // Browser storage is an external store, so React subscribes to it directly rather than
  // mirroring it into state inside an effect. The snapshot is the raw JSON string, which
  // compares stably; the parsed list below is derived, not stored.
  const snapshot = useSyncExternalStore(subscribePublished, publishedSnapshot, emptySnapshot);
  // Array order is dashboard order, and inactive visuals stay published but hidden —
  // both are set in the Reports Visualizer's Manage dialog.
  const visuals = parsePublished(snapshot).filter((v) => v.active);

  useEffect(() => {
    const configs = parsePublished(snapshot)
      .filter((v) => v.active)
      .map((v) => v.config);
    if (configs.length === 0) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setFailed(false);
      try {
        const query = new URLSearchParams({
          configs: JSON.stringify(configs),
          from: fromStr,
          to: toStr,
        });
        const response = await fetch(apiPath(`/api/report-builder/preview?${query}`), {
          cache: "no-store",
        });
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as { results: ReportResult[] };
        if (!cancelled) setResultState({ key: snapshot, results: data.results ?? [] });
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [snapshot, fromStr, toStr]);

  // Sort order is a way of looking at a visual, not part of its definition, so it stays in
  // component state rather than being published with the config. Descending by default —
  // with only the first few entries drawn, the largest are the ones worth showing.
  const [sortById, setSortById] = useState<Record<string, SortDirection>>({});
  const sortFor = (id: string): SortDirection => sortById[id] ?? "desc";

  // Which visual is being renamed, if any. Held by id rather than by object so the entry
  // can re-render underneath the dialog without stranding it on a stale copy.
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const renaming = visuals.find((v) => v.config.id === renamingId);

  const isCurrent = resultState.key === snapshot;

  // Nothing pinned yet: show the invitation instead of the shelf. Once a visual exists
  // the prompt is redundant — the Reports Visualizer is one click away in the nav, and a
  // permanent "build one" card on a working dashboard is just noise.
  if (visuals.length === 0) {
    return (
      <Card className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h2 className="font-heading text-sm font-semibold text-text">
            Build your own dashboard visual
          </h2>
          <p className="mt-0.5 text-xs text-text-muted">
            Chart any of your POS data and pin it here. Published visuals follow the date
            range above.
          </p>
        </div>
        <LinkButton href="/report-builder" variant="secondary">
          <ChartBarIcon className="h-4 w-4" />
          Open Reports Visualizer
        </LinkButton>
      </Card>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      {/* A rule rather than a heading: the visuals are the admin's own and already carry
          their own titles, so a "Your visuals" banner over them was label on top of label.
          The line just separates them from the stat cards above. */}
      <hr className="border-t border-border" />

      {failed && (
        <p className="text-xs text-danger">Couldn&rsquo;t load these visuals. Refresh to try again.</p>
      )}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {visuals.map((entry, index) => {
          const spec = VISUALS.find((v) => v.type === entry.config.visualType);
          const result = isCurrent ? (resultState.results[index] ?? EMPTY_RESULT) : EMPTY_RESULT;
          return (
            <Card key={entry.config.id} className="flex flex-col gap-4 p-0">
              <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
                <div className="min-w-0">
                  <h3 className="font-heading text-sm font-semibold text-text">{entry.config.name}</h3>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {spec?.label} · {getDataset(entry.config.datasetId)?.label}
                  </p>
                </div>
                <VisualMenu
                  label={entry.config.name}
                  sortDirection={sortFor(entry.config.id)}
                  onToggleSort={() =>
                    setSortById((current) => ({
                      ...current,
                      [entry.config.id]: sortFor(entry.config.id) === "desc" ? "asc" : "desc",
                    }))
                  }
                  onRename={() => setRenamingId(entry.config.id)}
                  onExport={() => downloadResultCsv(entry.config.name, entry.config, result)}
                  onRemove={() => deleteVisual(entry.config.id)}
                />
              </div>
              <div className="px-4 pb-4">
                <ReportVisual
                  config={entry.config}
                  result={result}
                  height={220}
                  pending={loading || !isCurrent}
                  sortDirection={sortFor(entry.config.id)}
                />
              </div>
            </Card>
          );
        })}
      </div>

      {renaming && (
        <RenameVisualModal
          id={renaming.config.id}
          currentName={renaming.config.name}
          onClose={() => setRenamingId(null)}
        />
      )}
    </section>
  );
}
