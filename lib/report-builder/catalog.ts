/**
 * Report builder — dataset and visual catalog.
 *
 * This file is the allowlist. Every table name, join and column expression the builder
 * can ever emit is written here by hand; a `ReportConfig` only ever references these by
 * id. Nothing typed by a user reaches SQL as an identifier — user text only ever arrives
 * as a bound parameter (see query.ts). Adding a dataset means adding an entry here, not
 * loosening the compiler.
 *
 * Datasets are modelled as a fixed FROM/JOIN block plus a flat field list, which is the
 * shape a builder UI wants: pick a dataset, then drag fields into visual slots. The joins
 * are deliberately wide (product → category, sale → cashier) so a single dataset can
 * answer most questions about its subject without the user thinking about joins at all.
 */

import type { Aggregation, FieldRole, SlotName, VisualType } from "./types";

export interface DatasetField {
  /** Stable id referenced by configs. Unique within its dataset. */
  id: string;
  label: string;
  role: FieldRole;
  /** SQL expression, authored here only. Never interpolated from user input. */
  expr: string;
  /** Metric fields only. First entry is the default aggregation. */
  aggregations?: Aggregation[];
  /** Rendered as a currency amount in the preview. */
  currency?: boolean;
  hint?: string;
}

export interface Dataset {
  id: string;
  label: string;
  description: string;
  /** FROM + JOIN block. Aliases used here are the ones every field expression assumes. */
  from: string;
  /**
   * Predicate applied to every query on this dataset — the "this is what the dataset
   * means" filter (e.g. sales datasets only ever count completed sales). Kept separate
   * from user filters so it can't be edited away in the UI.
   */
  baseWhere?: string;
  fields: DatasetField[];
}

const MONEY: Aggregation[] = ["sum", "avg", "min", "max"];
const QTY: Aggregation[] = ["sum", "avg", "min", "max"];
const TALLY: Aggregation[] = ["count", "distinct_count"];

export const DATASETS: Dataset[] = [
  {
    id: "sales",
    label: "Sales",
    description: "One row per completed sale — totals, cashier, register, customer.",
    from: `sales s
      LEFT JOIN locations l ON l.id = s."locationId"
      LEFT JOIN registers r ON r.id = s."registerId"
      LEFT JOIN users u ON u.id = s."cashierId"
      LEFT JOIN customers cu ON cu.id = s."customerId"`,
    baseWhere: `s.status = 'COMPLETED'`,
    fields: [
      { id: "completedAt", label: "Completed at", role: "date", expr: `s."completedAt"` },
      { id: "createdAt", label: "Created at", role: "date", expr: `s."createdAt"` },
      { id: "cashier", label: "Cashier", role: "dimension", expr: `COALESCE(u.name, 'Unknown')` },
      { id: "location", label: "Location", role: "dimension", expr: `COALESCE(l.name, 'Unknown')` },
      { id: "register", label: "Register", role: "dimension", expr: `COALESCE(r.name, 'Unknown')` },
      {
        id: "customer",
        label: "Customer",
        role: "dimension",
        expr: `COALESCE(cu.name, 'Walk-in')`,
        hint: "Sales with no linked customer group under “Walk-in”.",
      },
      { id: "receiptNumber", label: "Receipt number", role: "dimension", expr: `s."receiptNumber"` },
      { id: "grandTotal", label: "Grand total", role: "metric", expr: `s."grandTotal"`, aggregations: MONEY, currency: true },
      { id: "subtotal", label: "Subtotal", role: "metric", expr: `s.subtotal`, aggregations: MONEY, currency: true },
      { id: "discountTotal", label: "Discount total", role: "metric", expr: `s."discountTotal"`, aggregations: MONEY, currency: true },
      { id: "taxTotal", label: "Tax total", role: "metric", expr: `s."taxTotal"`, aggregations: MONEY, currency: true },
      { id: "saleCount", label: "Sale count", role: "metric", expr: `s.id`, aggregations: TALLY },
    ],
  },
  {
    id: "sale_line_items",
    label: "Sale line items",
    description: "One row per product sold — the dataset for product and category questions.",
    from: `sale_line_items li
      JOIN sales s ON s.id = li."saleId"
      LEFT JOIN products p ON p.id = li."productId"
      LEFT JOIN categories c ON c.id = p."categoryId"
      LEFT JOIN product_variants pv ON pv.id = li."variantId"`,
    baseWhere: `s.status = 'COMPLETED'`,
    fields: [
      { id: "completedAt", label: "Sale completed at", role: "date", expr: `s."completedAt"` },
      { id: "product", label: "Product", role: "dimension", expr: `COALESCE(p.name, 'Unknown product')` },
      { id: "sku", label: "SKU", role: "dimension", expr: `COALESCE(p.sku, '—')` },
      { id: "category", label: "Category", role: "dimension", expr: `COALESCE(c.name, 'Uncategorised')` },
      { id: "variant", label: "Variant", role: "dimension", expr: `COALESCE(pv.name, 'Base unit')` },
      { id: "receiptNumber", label: "Receipt number", role: "dimension", expr: `s."receiptNumber"` },
      { id: "quantity", label: "Quantity", role: "metric", expr: `li.quantity`, aggregations: QTY },
      { id: "lineTotal", label: "Line revenue", role: "metric", expr: `li."lineTotal"`, aggregations: MONEY, currency: true },
      { id: "unitPrice", label: "Unit price", role: "metric", expr: `li."unitPrice"`, aggregations: ["avg", "min", "max", "sum"], currency: true },
      { id: "discountAmount", label: "Line discount", role: "metric", expr: `li."discountAmount"`, aggregations: MONEY, currency: true },
      { id: "taxAmount", label: "Line tax", role: "metric", expr: `li."taxAmount"`, aggregations: MONEY, currency: true },
      {
        id: "grossMargin",
        label: "Gross margin",
        role: "metric",
        expr: `(li."lineTotal" - li.quantity * p."costPrice")`,
        aggregations: MONEY,
        currency: true,
        hint: "Line revenue minus quantity × current cost price.",
      },
      { id: "lineCount", label: "Line count", role: "metric", expr: `li.id`, aggregations: TALLY },
    ],
  },
  {
    id: "payments",
    label: "Payments",
    description: "One row per payment taken — tender mix and change given.",
    from: `payments pay
      LEFT JOIN payment_methods pm ON pm.id = pay."paymentMethodId"
      JOIN sales s ON s.id = pay."saleId"`,
    baseWhere: `s.status = 'COMPLETED'`,
    fields: [
      { id: "createdAt", label: "Paid at", role: "date", expr: `pay."createdAt"` },
      { id: "method", label: "Payment method", role: "dimension", expr: `COALESCE(pm.name, 'Unknown')` },
      { id: "receiptNumber", label: "Receipt number", role: "dimension", expr: `s."receiptNumber"` },
      { id: "amount", label: "Amount", role: "metric", expr: `pay.amount`, aggregations: MONEY, currency: true },
      { id: "tenderedAmount", label: "Tendered", role: "metric", expr: `COALESCE(pay."tenderedAmount", 0)`, aggregations: MONEY, currency: true },
      { id: "changeGiven", label: "Change given", role: "metric", expr: `COALESCE(pay."changeGiven", 0)`, aggregations: MONEY, currency: true },
      { id: "paymentCount", label: "Payment count", role: "metric", expr: `pay.id`, aggregations: TALLY },
    ],
  },
  {
    id: "inventory",
    label: "Inventory (current)",
    description: "Live stock snapshot — no dates, so trend visuals are unavailable here.",
    from: `inventory i
      LEFT JOIN products p ON p.id = i."productId"
      LEFT JOIN categories c ON c.id = p."categoryId"
      LEFT JOIN locations l ON l.id = i."locationId"`,
    fields: [
      { id: "product", label: "Product", role: "dimension", expr: `COALESCE(p.name, 'Unknown product')` },
      { id: "sku", label: "SKU", role: "dimension", expr: `COALESCE(p.sku, '—')` },
      { id: "category", label: "Category", role: "dimension", expr: `COALESCE(c.name, 'Uncategorised')` },
      { id: "location", label: "Location", role: "dimension", expr: `COALESCE(l.name, 'Unknown')` },
      { id: "isActive", label: "Active", role: "dimension", expr: `CASE WHEN p."isActive" THEN 'Active' ELSE 'Inactive' END` },
      { id: "quantityOnHand", label: "Quantity on hand", role: "metric", expr: `i."quantityOnHand"`, aggregations: QTY },
      { id: "stockValue", label: "Stock value (cost)", role: "metric", expr: `(i."quantityOnHand" * p."costPrice")`, aggregations: MONEY, currency: true },
      { id: "retailValue", label: "Stock value (retail)", role: "metric", expr: `(i."quantityOnHand" * p."sellPrice")`, aggregations: MONEY, currency: true },
      { id: "costPrice", label: "Cost price", role: "metric", expr: `p."costPrice"`, aggregations: ["avg", "min", "max"], currency: true },
      { id: "sellPrice", label: "Sell price", role: "metric", expr: `p."sellPrice"`, aggregations: ["avg", "min", "max"], currency: true },
      { id: "productCount", label: "Product count", role: "metric", expr: `p.id`, aggregations: ["distinct_count", "count"] },
    ],
  },
  {
    id: "stock_movements",
    label: "Stock movements",
    description: "The stock ledger — every adjustment, receipt, sale deduction and write-off.",
    from: `stock_movements sm
      LEFT JOIN products p ON p.id = sm."productId"
      LEFT JOIN categories c ON c.id = p."categoryId"
      LEFT JOIN users u ON u.id = sm."createdById"
      LEFT JOIN locations l ON l.id = sm."locationId"`,
    fields: [
      { id: "createdAt", label: "Moved at", role: "date", expr: `sm."createdAt"` },
      { id: "product", label: "Product", role: "dimension", expr: `COALESCE(p.name, 'Unknown product')` },
      { id: "sku", label: "SKU", role: "dimension", expr: `COALESCE(p.sku, '—')` },
      { id: "category", label: "Category", role: "dimension", expr: `COALESCE(c.name, 'Uncategorised')` },
      { id: "reason", label: "Reason", role: "dimension", expr: `sm.reason::text` },
      { id: "location", label: "Location", role: "dimension", expr: `COALESCE(l.name, 'Unknown')` },
      { id: "createdBy", label: "Recorded by", role: "dimension", expr: `COALESCE(u.name, 'System')` },
      { id: "quantityDelta", label: "Quantity change", role: "metric", expr: `sm."quantityDelta"`, aggregations: QTY },
      {
        id: "unitsOut",
        label: "Units out",
        role: "metric",
        expr: `(CASE WHEN sm."quantityDelta" < 0 THEN -sm."quantityDelta" ELSE 0 END)`,
        aggregations: QTY,
        hint: "Absolute value of negative movements only.",
      },
      { id: "movementCount", label: "Movement count", role: "metric", expr: `sm.id`, aggregations: TALLY },
    ],
  },
];


/**
 * The date column the dashboard's range filter scopes each dataset by. Kept beside the
 * datasets rather than inside them so it is obvious at a glance which data can be
 * time-filtered at all — the inventory snapshot cannot, and says so with `null`.
 */
export const DATASET_RANGE_FIELD: Record<string, string | null> = {
  sales: "completedAt",
  sale_line_items: "completedAt",
  payments: "createdAt",
  inventory: null,
  stock_movements: "createdAt",
};

export interface SlotSpec {
  name: SlotName;
  label: string;
  required: boolean;
  accepts: FieldRole[];
  hint: string;
}

export interface VisualSpec {
  type: VisualType;
  label: string;
  whenToUse: string;
  slots: SlotSpec[];
}

/** Slot definitions shared across the trend visuals, which bind identically. */
const TREND_SLOTS: SlotSpec[] = [
  { name: "xAxis", label: "X axis", required: true, accepts: ["date", "dimension"], hint: "Bucketed automatically by the dashboard's date range." },
  { name: "value", label: "Value", required: true, accepts: ["metric"], hint: "" },
  { name: "series", label: "Split into series", required: false, accepts: ["dimension"], hint: "Optional — one line per value." },
];

/** Slot definitions shared by the part-of-whole visuals. */
const SHARE_SLOTS: SlotSpec[] = [
  { name: "category", label: "Slice", required: true, accepts: ["dimension"], hint: "" },
  { name: "value", label: "Slice size", required: true, accepts: ["metric"], hint: "Top slices only — small ones are grouped." },
];

export const VISUALS: VisualSpec[] = [
  {
    type: "kpi",
    label: "KPI",
    whenToUse: "One headline number for the whole range — no breakdown.",
    slots: [
      {
        name: "value",
        label: "Metric",
        required: true,
        accepts: ["metric"],
        hint: "Aggregated across every row in range.",
      },
    ],
  },
  {
    type: "pivot",
    label: "Pivot table",
    whenToUse: "Cross-tabulating one measure across two dimensions, with row totals.",
    slots: [
      { name: "rows", label: "Rows", required: true, accepts: ["dimension", "date"], hint: "" },
      { name: "columns", label: "Columns", required: true, accepts: ["dimension", "date"], hint: "Keep the number of distinct values low." },
      { name: "value", label: "Cell value", required: true, accepts: ["metric"], hint: "" },
    ],
  },
  {
    type: "area",
    label: "Graph",
    whenToUse: "Volume over time — a filled trend, good for totals that accumulate.",
    slots: TREND_SLOTS,
  },
  {
    type: "bar",
    label: "Bar graph",
    whenToUse: "Comparing a measure across categories or time buckets.",
    slots: [
      { name: "xAxis", label: "X axis", required: true, accepts: ["dimension", "date"], hint: "One bar per value." },
      { name: "value", label: "Bar height", required: true, accepts: ["metric"], hint: "" },
    ],
  },
  {
    type: "donut",
    label: "Donut",
    whenToUse: "Share of a whole, with the total readable in the middle.",
    slots: SHARE_SLOTS,
  },
  {
    type: "line",
    label: "Line chart",
    whenToUse: "Trend over time, especially when comparing several series.",
    slots: TREND_SLOTS,
  },
  {
    type: "pie",
    label: "Pie graph",
    whenToUse: "Share of a whole, as a solid circle.",
    slots: SHARE_SLOTS,
  },
];

/** Visuals that rank by value and keep only the top slices. */
export const SHARE_VISUALS: ReadonlySet<VisualType> = new Set(["donut", "pie"]);

export function getDataset(datasetId: string): Dataset | undefined {
  return DATASETS.find((d) => d.id === datasetId);
}

export function getField(dataset: Dataset, fieldId: string): DatasetField | undefined {
  return dataset.fields.find((f) => f.id === fieldId);
}

export function getVisual(visualType: VisualType): VisualSpec | undefined {
  return VISUALS.find((v) => v.type === visualType);
}

/** Fields in `dataset` that `slot` will accept — what the UI offers in its picker. */
export function fieldsForSlot(dataset: Dataset, slot: SlotSpec): DatasetField[] {
  return dataset.fields.filter((f) => slot.accepts.includes(f.role));
}

export function defaultAggregation(field: DatasetField): Aggregation {
  return field.aggregations?.[0] ?? "sum";
}
