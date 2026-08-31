/**
 * Report builder — config construction and repair.
 *
 * Switching data source or visual type invalidates slot assignments (a field id only means
 * something inside its own dataset, and each visual has a different set of slots). Rather
 * than scatter that clean-up through the UI's event handlers, every edit funnels back
 * through `normalizeConfig`, which drops anything the current dataset/visual can't honour
 * and fills in the defaults it can. The UI is then free to make a naive change and hand
 * the result here.
 */

import {
  defaultAggregation,
  fieldsForSlot,
  getDataset,
  getField,
  getVisual,
  DATASETS,
} from "./catalog";
import type { Aggregation, ReportConfig, SlotName, SlotValue, VisualType } from "./types";

/** Every field id bound to any slot of the current visual, in slot order. */
export function assignedFieldIds(config: ReportConfig): string[] {
  const visual = getVisual(config.visualType);
  if (!visual) return [];
  return visual.slots
    .map((slot) => config.slots[slot.name])
    .filter((id): id is string => Boolean(id));
}

/**
 * Ids are generated rather than derived from the name so renaming a published visual
 * never orphans it on the dashboard.
 */
export function newVisualId(): string {
  return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createDefaultConfig(): ReportConfig {
  // Seeded with revenue-over-time: a builder that opens empty makes people guess what it
  // does, and this shows a filled slot and an aggregation at once.
  return normalizeConfig({
    version: 2,
    id: newVisualId(),
    name: "Revenue over time",
    datasetId: DATASETS[0].id,
    visualType: "line",
    slots: { xAxis: "completedAt", value: "grandTotal", series: null },
    aggregations: { grandTotal: "sum" },
    filters: [],
  });
}

/**
 * Coerce a config into something the current dataset and visual can actually express.
 * Unknown fields, slots the visual doesn't have, and role mismatches are dropped rather
 * than reported — validation is a separate concern and speaks about what's *missing*.
 */
export function normalizeConfig(input: ReportConfig): ReportConfig {
  const dataset = getDataset(input.datasetId) ?? DATASETS[0];
  const visual = getVisual(input.visualType) ?? getVisual("bar")!;

  const slots: Partial<Record<SlotName, SlotValue>> = {};
  for (const slot of visual.slots) {
    const candidate = input.slots[slot.name];
    const allowed = new Set(fieldsForSlot(dataset, slot).map((f) => f.id));
    slots[slot.name] = candidate && allowed.has(candidate) ? candidate : null;
  }

  // Keep aggregations only for fields still in play, and only values the field supports.
  const aggregations: Record<string, Aggregation> = {};
  for (const fieldId of new Set(Object.values(slots).filter((v): v is string => Boolean(v)))) {
    const field = getField(dataset, fieldId);
    if (!field || field.role !== "metric") continue;
    const requested = input.aggregations[fieldId];
    const supported = field.aggregations ?? [];
    aggregations[fieldId] =
      requested && supported.includes(requested) ? requested : defaultAggregation(field);
  }

  return {
    version: 2,
    id: input.id,
    name: input.name,
    datasetId: dataset.id,
    visualType: visual.type,
    slots,
    aggregations,
    filters: input.filters.filter((f) => Boolean(getField(dataset, f.field))),
  };
}

/** Applies a slot edit and re-normalises in one step — the UI's only mutation path. */
export function setSlot(config: ReportConfig, slot: SlotName, value: SlotValue): ReportConfig {
  return normalizeConfig({ ...config, slots: { ...config.slots, [slot]: value } });
}

export function setVisualType(config: ReportConfig, visualType: VisualType): ReportConfig {
  return normalizeConfig({ ...config, visualType });
}

/**
 * Switching data source clears slots outright. Carrying same-named fields across datasets
 * looks clever and reliably produces a report nobody asked for.
 */
export function setDataset(config: ReportConfig, datasetId: string): ReportConfig {
  return normalizeConfig({
    ...config,
    datasetId,
    slots: {},
    aggregations: {},
    filters: [],
  });
}

export function metricAlias(fieldId: string, aggregation: Aggregation | undefined): string {
  return `${fieldId}__${aggregation ?? "sum"}`;
}

/**
 * Rebuild a config from untrusted JSON (an API request body, or something recovered from
 * browser storage). Every field is re-derived rather than trusted, then run through
 * `normalizeConfig`, so anything that isn't in the catalog is discarded before it can
 * reach the query layer. Returns null only when the input isn't an object at all.
 */
export function coerceConfig(input: unknown): ReportConfig | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;

  const slots: Partial<Record<SlotName, SlotValue>> = {};
  const rawSlots = (raw.slots ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(rawSlots)) {
    slots[key as SlotName] = typeof value === "string" && value ? value : null;
  }

  const aggregations: Record<string, Aggregation> = {};
  const rawAggs = (raw.aggregations ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(rawAggs)) {
    if (typeof value === "string") aggregations[key] = value as Aggregation;
  }

  const filters = Array.isArray(raw.filters)
    ? raw.filters.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const f = entry as Record<string, unknown>;
        if (typeof f.field !== "string" || typeof f.operator !== "string") return [];
        return [
          {
            id: typeof f.id === "string" ? f.id : newVisualId(),
            field: f.field,
            operator: f.operator as ReportConfig["filters"][number]["operator"],
            value: typeof f.value === "string" ? f.value : "",
          },
        ];
      })
    : [];

  return normalizeConfig({
    version: 2,
    id: typeof raw.id === "string" && raw.id ? raw.id : newVisualId(),
    name: typeof raw.name === "string" ? raw.name : "Untitled visual",
    datasetId: typeof raw.datasetId === "string" ? raw.datasetId : DATASETS[0].id,
    visualType: (typeof raw.visualType === "string" ? raw.visualType : "bar") as VisualType,
    slots,
    aggregations,
    filters,
  });
}
