/**
 * Report builder — configuration model.
 *
 * A visual is one serialisable object (`ReportConfig`). Nothing in the UI holds report
 * state of its own: the panel edits the config, the validator reads it, the query layer
 * turns it into SQL, and publishing stores it verbatim. That is what lets a published
 * dashboard visual be re-rendered later from nothing but its config.
 *
 * A config never contains SQL, table names, or column expressions — only *ids* that must
 * resolve against the data catalog (see catalog.ts). Identifiers reaching the database
 * therefore always come from our own allowlist, never from user input.
 *
 * Deliberately absent: date range, grain, sort and row limit. The dashboard's own date
 * filter supplies the range, the grain is derived from it, and sort/limit follow from the
 * visual type. A visual is a question, not a set of viewing preferences.
 */

/** Sort order for whatever a visual ranks — bars, slices, series, pivot rows. */
export type SortDirection = "asc" | "desc";

/** What a field can be used for. Drives which slots will accept it. */
export type FieldRole = "dimension" | "metric" | "date";

export type Aggregation = "sum" | "avg" | "count" | "distinct_count" | "min" | "max";

/** Bucket size for date dimensions. Derived from the active range, never chosen by hand. */
export type DateGrain = "hour" | "day" | "week" | "month";

/**
 * Visual roles a field can be bound to. Each visual type declares which of these it
 * requires and which it merely accepts.
 */
export type SlotName = "xAxis" | "value" | "series" | "category" | "rows" | "columns";

/**
 * The report types an admin can build. `area` is the general-purpose "graph" — a filled
 * trend, distinct from the plain line chart. `kpi` is the odd one out: a single headline
 * number with no dimension at all.
 */
export type VisualType = "kpi" | "pivot" | "area" | "bar" | "donut" | "line" | "pie";

export type FilterOperator =
  | "eq"
  | "neq"
  | "contains"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "is_null"
  | "not_null";

export interface ReportFilter {
  /** Client-side identity only — lets the UI key rows without reordering churn. */
  id: string;
  /** Field id, resolved against the selected dataset. */
  field: string;
  operator: FilterOperator;
  value: string;
}

/**
 * A slot holds a single field id or nothing yet. Every slot in the current visual set is
 * single-valued; `null` means unassigned.
 */
export type SlotValue = string | null;

export interface ReportConfig {
  /** Bumped whenever the shape changes, so stored configs can be migrated. */
  version: 2;
  /** Stable identity, assigned on publish. */
  id: string;
  name: string;
  datasetId: string;
  visualType: VisualType;
  slots: Partial<Record<SlotName, SlotValue>>;
  /** Field id → aggregation. Only meaningful for metric fields bound to a slot. */
  aggregations: Record<string, Aggregation>;
  filters: ReportFilter[];
}

/**
 * A config that has been published to the dashboard.
 *
 * Array order *is* dashboard order — there is no separate index to keep in sync. `active`
 * lets a visual be parked without losing its definition, which is the difference between
 * hiding something and having to rebuild it later.
 */
export interface PublishedVisual {
  config: ReportConfig;
  /** ISO timestamp, shown in the manage list so the admin can tell versions apart. */
  publishedAt: string;
  /** Shown on the dashboard. Inactive visuals stay published but hidden. */
  active: boolean;
}

/** One column in the result set. */
export interface ReportColumn {
  /** SQL alias — also the key on every row object. */
  alias: string;
  label: string;
  role: FieldRole;
  /** Present for metric columns so the UI can label "Revenue (sum)". */
  aggregation?: Aggregation;
  /** Which slot produced this column, so charts bind by meaning, not position. */
  slot: SlotName;
  /** Source field id, so the UI can trace a column back to the catalog. */
  fieldId: string;
  /** Render as a currency amount. */
  currency: boolean;
}

export type ReportRow = Record<string, string | number | null>;

export interface ReportResult {
  columns: ReportColumn[];
  rows: ReportRow[];
  truncated: boolean;
}

export const AGGREGATION_LABELS: Record<Aggregation, string> = {
  sum: "Sum",
  avg: "Average",
  count: "Count",
  distinct_count: "Distinct count",
  min: "Minimum",
  max: "Maximum",
};

export const FILTER_OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: "equals",
  neq: "does not equal",
  contains: "contains",
  gt: "greater than",
  gte: "at least",
  lt: "less than",
  lte: "at most",
  is_null: "is empty",
  not_null: "is not empty",
};

/** Operators that read no value at all — the UI hides the value input for these. */
export const VALUELESS_OPERATORS: ReadonlySet<FilterOperator> = new Set(["is_null", "not_null"]);

/**
 * Hard ceiling on returned groups. Not a user setting: it exists so one badly chosen
 * dimension (receipt number, say) can't return 50,000 bars.
 */
export const MAX_GROUPS = 200;

/** Category-style visuals get the top N by value; more slices than this is unreadable. */
export const MAX_SLICES = 8;

/**
 * Bucket size for a span. The dashboard's date filter picks the dates; this picks the
 * grain, so the admin never has to think about it — and so a chart never renders 400
 * hourly columns because someone picked a whole year.
 *
 * Thresholds are chosen to keep any axis roughly under ~35 points.
 */
export function grainForSpan(fromMs: number, toMs: number): DateGrain {
  const days = Math.max(1, Math.round((toMs - fromMs) / 86_400_000));
  if (days <= 1) return "hour";
  if (days <= 35) return "day";
  if (days <= 210) return "week";
  return "month";
}
