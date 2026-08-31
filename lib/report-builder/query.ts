import "server-only";

import { prisma } from "@/lib/prisma";
import { STORE_TIME_ZONE, type DateRange } from "@/lib/reports";
import {
  DATASET_RANGE_FIELD,
  SHARE_VISUALS,
  getDataset,
  getField,
  getVisual,
  type Dataset,
  type DatasetField,
} from "./catalog";
import { metricAlias } from "./config";
import { validateConfig } from "./validate";
import {
  grainForSpan,
  MAX_GROUPS,
  MAX_SLICES,
  type Aggregation,
  type DateGrain,
  type ReportColumn,
  type ReportConfig,
  type ReportResult,
  type ReportRow,
  type SlotName,
} from "./types";

/**
 * Report builder — query layer.
 *
 * Turns a config into one read-only aggregate SELECT and runs it. Three rules hold the
 * safety story together, and all three live here:
 *
 *  1. Every identifier — table, join, column expression — comes from catalog.ts. A config
 *     carries ids, never SQL, so there is no path from user text to an identifier.
 *  2. Every user value is a bound parameter. Filter values, the date range and the store
 *     timezone are all `$n` placeholders.
 *  3. Read-only by construction: this module emits SELECT and nothing else. It never
 *     writes, and it never alters schema.
 *
 * The date range is supplied by the caller (the dashboard's date filter), not by the
 * config — a visual describes *what* to show, the dashboard decides *when*. The bucket
 * grain follows from the span, so a one-day range renders hours and a one-year range
 * renders months without anyone choosing.
 */

interface Binding {
  slot: SlotName;
  field: DatasetField;
  alias: string;
  aggregation?: Aggregation;
}

function resolveBindings(config: ReportConfig, dataset: Dataset): Binding[] {
  const visual = getVisual(config.visualType);
  if (!visual) return [];

  const bindings: Binding[] = [];
  for (const slot of visual.slots) {
    const fieldId = config.slots[slot.name];
    if (!fieldId) continue;
    const field = getField(dataset, fieldId);
    if (!field) continue;
    const aggregation = field.role === "metric" ? config.aggregations[fieldId] : undefined;
    const alias = field.role === "metric" ? metricAlias(fieldId, aggregation) : field.id;
    if (bindings.some((b) => b.alias === alias)) continue;
    bindings.push({ slot: slot.name, field, alias, aggregation });
  }

  // Dimensions first — that is the reading order for a table, and GROUP BY ordinals
  // depend on it.
  return [
    ...bindings.filter((b) => b.field.role !== "metric"),
    ...bindings.filter((b) => b.field.role === "metric"),
  ];
}

const GRAIN_FORMAT: Record<DateGrain, string> = {
  hour: "HH24:00",
  day: "YYYY-MM-DD",
  week: 'IYYY-"W"IW',
  month: "YYYY-MM",
};

const AGG_SQL: Record<Aggregation, (expr: string) => string> = {
  sum: (e) => `SUM(${e})`,
  avg: (e) => `AVG(${e})`,
  count: (e) => `COUNT(${e})`,
  distinct_count: (e) => `COUNT(DISTINCT ${e})`,
  min: (e) => `MIN(${e})`,
  max: (e) => `MAX(${e})`,
};

const SQL_OPERATORS: Record<string, string> = {
  eq: "=",
  neq: "<>",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
};

/**
 * Timestamps are stored naive-UTC, so bucketing has to be shifted into the store's wall
 * clock first — otherwise an 8pm Manila sale files under the next UTC day. Same treatment
 * the hand-written reports in lib/reports.ts use.
 */
const inStoreZone = (expr: string, tzParam: string) => `(${expr} AT TIME ZONE 'UTC' AT TIME ZONE ${tzParam})`;

export function buildQuery(
  config: ReportConfig,
  range: DateRange,
): { sql: string; params: unknown[]; columns: ReportColumn[] } | null {
  const dataset = getDataset(config.datasetId);
  if (!dataset) return null;

  const bindings = resolveBindings(config, dataset);
  if (bindings.length === 0) return null;

  const params: unknown[] = [];
  const bind = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  // Bound on first use only. Postgres rejects a prepared statement carrying a parameter
  // that never appears in the text ("could not determine data type of parameter $1"), and
  // a visual grouped by cashier rather than by date needs no timezone at all. The ::text
  // cast pins the type, which the planner cannot infer from `AT TIME ZONE` alone.
  let tzPlaceholder: string | null = null;
  const timezoneParam = () => {
    if (tzPlaceholder === null) tzPlaceholder = `${bind(STORE_TIME_ZONE)}::text`;
    return tzPlaceholder;
  };
  const grain = grainForSpan(range.from.getTime(), range.to.getTime());

  const selectParts = bindings.map((b) => {
    if (b.field.role === "metric") {
      return `  ${AGG_SQL[b.aggregation ?? "sum"](b.field.expr)}::float8 AS "${b.alias}"`;
    }
    if (b.field.role === "date") {
      const bucketed = `date_trunc('${grain}', ${inStoreZone(b.field.expr, timezoneParam())})`;
      return `  to_char(${bucketed}, '${GRAIN_FORMAT[grain]}') AS "${b.alias}"`;
    }
    return `  ${b.field.expr}::text AS "${b.alias}"`;
  });

  const where: string[] = [];
  if (dataset.baseWhere) where.push(dataset.baseWhere);

  // Scope to the dashboard's range, when this data has a date to scope by at all.
  const rangeFieldId = DATASET_RANGE_FIELD[dataset.id];
  const rangeField = rangeFieldId ? getField(dataset, rangeFieldId) : undefined;
  if (rangeField) {
    where.push(`${rangeField.expr} >= ${bind(range.from)}`);
    where.push(`${rangeField.expr} <= ${bind(range.to)}`);
  }

  for (const filter of config.filters) {
    const field = getField(dataset, filter.field);
    if (!field) continue;
    if (filter.operator === "is_null") {
      where.push(`${field.expr} IS NULL`);
      continue;
    }
    if (filter.operator === "not_null") {
      where.push(`${field.expr} IS NOT NULL`);
      continue;
    }
    if (!filter.value.trim()) continue;
    if (filter.operator === "contains") {
      where.push(`${field.expr}::text ILIKE ${bind(`%${filter.value.trim()}%`)}`);
      continue;
    }
    where.push(`${field.expr} ${SQL_OPERATORS[filter.operator] ?? "="} ${bind(filter.value.trim())}`);
  }

  const dimensionCount = bindings.filter((b) => b.field.role !== "metric").length;
  const metricIndex = bindings.findIndex((b) => b.field.role === "metric");

  // Share visuals rank by size and keep only the top slices; everything else reads in
  // dimension order, which is chronological for a date axis.
  const isShare = SHARE_VISUALS.has(config.visualType);
  const orderBy =
    isShare && metricIndex >= 0
      ? `${metricIndex + 1} DESC NULLS LAST`
      : dimensionCount > 0
        ? "1 ASC"
        : null;
  const limit = isShare ? MAX_SLICES : MAX_GROUPS;

  const lines = [`SELECT`, selectParts.join(",\n"), `FROM ${dataset.from.trim()}`];
  if (where.length > 0) lines.push(`WHERE ${where.join("\n  AND ")}`);
  if (dimensionCount > 0) {
    lines.push(`GROUP BY ${Array.from({ length: dimensionCount }, (_, i) => i + 1).join(", ")}`);
  }
  if (orderBy) lines.push(`ORDER BY ${orderBy}`);
  lines.push(`LIMIT ${limit + 1}`);

  const columns: ReportColumn[] = bindings.map((b) => ({
    alias: b.alias,
    label: b.field.label,
    role: b.field.role,
    aggregation: b.aggregation,
    slot: b.slot,
    fieldId: b.field.id,
    currency: Boolean(b.field.currency),
  }));

  return { sql: lines.join("\n"), params, columns };
}

/**
 * Run a config against live POS data. Returns an empty result rather than throwing when
 * the config is incomplete — the builder previews on every keystroke, and a half-built
 * visual is the normal case, not an error.
 */
export async function runReport(config: ReportConfig, range: DateRange): Promise<ReportResult> {
  if (!validateConfig(config).valid) return { columns: [], rows: [], truncated: false };

  const built = buildQuery(config, range);
  if (!built) return { columns: [], rows: [], truncated: false };

  const raw = await prisma.$queryRawUnsafe<ReportRow[]>(built.sql, ...built.params);

  const limit = SHARE_VISUALS.has(config.visualType) ? MAX_SLICES : MAX_GROUPS;
  const truncated = raw.length > limit;

  return { columns: built.columns, rows: raw.slice(0, limit), truncated };
}
