import "server-only";

import { prisma } from "@/lib/prisma";
import type { StockMovementReason } from "@/app/generated/prisma/enums";

export const DEFAULT_LOCATION_ID = 1;

const VALID_STOCK_MOVEMENT_REASONS: StockMovementReason[] = [
  "SALE",
  "RETURN",
  "ADJUSTMENT",
  "RECEIVING",
  "TRANSFER",
  "DAMAGE",
  "THEFT",
  "EXPIRY",
  "COUNT_CORRECTION",
];

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface DateRange {
  from: Date;
  to: Date;
  /** YYYY-MM-DD, for pre-filling the filter form's <input type="date"> defaultValue. */
  fromStr: string;
  toStr: string;
}

/**
 * The store's wall clock. Every "which day / which hour did this sale belong to?" decision
 * routes through this one timezone.
 *
 * It has to be explicit rather than "whatever the server's local time is": timestamps are
 * stored naive-UTC, the database session is UTC, and the app runs on Vercel (also UTC) —
 * so server-local bucketing would file an 8pm Manila sale under the *next* UTC day, and
 * would silently disagree with a developer machine sitting in another zone. Override with
 * the STORE_TIME_ZONE env var if the store isn't in Manila.
 */
export const STORE_TIME_ZONE = process.env.STORE_TIME_ZONE || "Asia/Manila";

const storeDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: STORE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const storePartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: STORE_TIME_ZONE,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** YYYY-MM-DD as it reads on a clock in the store's timezone. */
export function toStoreDateStr(d: Date): string {
  // en-CA formats as YYYY-MM-DD, which is exactly the <input type="date"> format.
  return storeDateFormatter.format(d);
}

/** The store timezone's UTC offset (ms) at a given instant — DST-correct, since it asks
 * Intl about that specific moment rather than assuming a fixed offset. */
function storeOffsetMs(at: Date): number {
  const parts = Object.fromEntries(
    storePartsFormatter.formatToParts(at).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asIfUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * The absolute instant of a wall-clock moment in the store's timezone, e.g.
 * storeInstant("2026-08-01", "00:00:00.000") is midnight *in Manila*, not midnight UTC.
 */
export function storeInstant(dateStr: string, timeStr: string): Date {
  const naive = new Date(`${dateStr}T${timeStr}Z`);
  // First guess the offset at the naive instant, then re-check at the corrected one so a
  // DST boundary within those few hours resolves to the right side.
  const firstPass = new Date(naive.getTime() - storeOffsetMs(naive));
  return new Date(naive.getTime() - storeOffsetMs(firstPass));
}

/** Store-local date N days before the given store date string. */
function shiftStoreDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`); // midday avoids DST edge wobble
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Parse `from`/`to` (YYYY-MM-DD) query params into a Date range. Defaults to the last 7 days
 * (inclusive of today) when absent or unparseable. `to` is normalized to end-of-day so the
 * range is inclusive of the whole day picked, not just midnight. Both boundaries are
 * resolved against the store's wall clock (see STORE_TIME_ZONE).
 */
export function parseDateRange(params: { from?: string; to?: string }): DateRange {
  const todayStr = toStoreDateStr(new Date());
  const defaultFromStr = shiftStoreDate(todayStr, -6);

  const fromStr = params.from && !Number.isNaN(Date.parse(params.from)) ? params.from : defaultFromStr;
  const toStr = params.to && !Number.isNaN(Date.parse(params.to)) ? params.to : todayStr;

  return {
    from: storeInstant(fromStr, "00:00:00.000"),
    to: storeInstant(toStr, "23:59:59.999"),
    fromStr,
    toStr,
  };
}

/** Validate a reason query param against the StockMovementReason enum; undefined if invalid/absent. */
export function parseStockMovementReason(reason: string | undefined): StockMovementReason | undefined {
  if (!reason) return undefined;
  return VALID_STOCK_MOVEMENT_REASONS.includes(reason as StockMovementReason)
    ? (reason as StockMovementReason)
    : undefined;
}

export const STOCK_MOVEMENT_REASONS = VALID_STOCK_MOVEMENT_REASONS;

// ---------- 1. Sales summary ----------

export interface SalesSummaryReport {
  totalSales: number;
  transactionCount: number;
  averageSale: number;
  byDay: { date: string; total: number; count: number }[];
  byPaymentMethod: { method: string; total: number }[];
}

/** Uses Sale.completedAt (not createdAt) — a sale can sit PARKED long before it completes,
 * so createdAt would misdate it for reporting purposes. Only COMPLETED sales count as revenue. */
export async function getSalesSummaryReport(range: DateRange): Promise<SalesSummaryReport> {
  const sales = await prisma.sale.findMany({
    where: { status: "COMPLETED", completedAt: { gte: range.from, lte: range.to } },
    select: { grandTotal: true, completedAt: true },
  });

  const transactionCount = sales.length;
  const totalSales = sales.reduce((sum, s) => sum + s.grandTotal.toNumber(), 0);
  const averageSale = transactionCount > 0 ? totalSales / transactionCount : 0;

  const byDayMap = new Map<string, { total: number; count: number }>();
  for (const s of sales) {
    // Store-local day, matching how the range boundaries were resolved — bucketing by the
    // raw UTC date would file an 8pm Manila sale under the following day.
    const day = toStoreDateStr(s.completedAt!);
    const entry = byDayMap.get(day) ?? { total: 0, count: 0 };
    entry.total += s.grandTotal.toNumber();
    entry.count += 1;
    byDayMap.set(day, entry);
  }
  const byDay = Array.from(byDayMap.entries())
    .map(([date, v]) => ({ date, total: round2(v.total), count: v.count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const paymentGroups = await prisma.payment.groupBy({
    by: ["paymentMethodId"],
    where: { sale: { status: "COMPLETED", completedAt: { gte: range.from, lte: range.to } } },
    _sum: { amount: true },
  });
  const methods = await prisma.paymentMethod.findMany({ select: { id: true, name: true } });
  const methodNameById = new Map(methods.map((m) => [m.id, m.name]));
  const byPaymentMethod = paymentGroups
    .map((g) => ({
      method: methodNameById.get(g.paymentMethodId) ?? `#${g.paymentMethodId}`,
      total: round2(Number(g._sum.amount ?? 0)),
    }))
    .sort((a, b) => b.total - a.total);

  return {
    totalSales: round2(totalSales),
    transactionCount,
    averageSale: round2(averageSale),
    byDay,
    byPaymentMethod,
  };
}

// ---------- 2. Product performance ----------

export interface ProductPerformanceRow {
  productId: number;
  name: string;
  sku: string;
  quantitySold: number;
  revenue: number;
}

export interface ProductPerformanceReport {
  byQuantityDesc: ProductPerformanceRow[];
  byQuantityAsc: ProductPerformanceRow[];
  byRevenueDesc: ProductPerformanceRow[];
  byRevenueAsc: ProductPerformanceRow[];
}

export async function getProductPerformanceReport(range: DateRange): Promise<ProductPerformanceReport> {
  const groups = await prisma.saleLineItem.groupBy({
    by: ["productId"],
    where: { sale: { status: "COMPLETED", completedAt: { gte: range.from, lte: range.to } } },
    _sum: { quantity: true, lineTotal: true },
  });

  const productIds = groups.map((g) => g.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, sku: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const rows: ProductPerformanceRow[] = groups.map((g) => {
    const p = byId.get(g.productId);
    return {
      productId: g.productId,
      name: p?.name ?? `Product #${g.productId}`,
      sku: p?.sku ?? "—",
      quantitySold: Number(g._sum.quantity ?? 0),
      revenue: round2(Number(g._sum.lineTotal ?? 0)),
    };
  });

  return {
    byQuantityDesc: [...rows].sort((a, b) => b.quantitySold - a.quantitySold),
    byQuantityAsc: [...rows].sort((a, b) => a.quantitySold - b.quantitySold),
    byRevenueDesc: [...rows].sort((a, b) => b.revenue - a.revenue),
    byRevenueAsc: [...rows].sort((a, b) => a.revenue - b.revenue),
  };
}

// ---------- 2b. Sales by category ----------

export interface CategorySalesRow {
  categoryId: number | null;
  categoryName: string;
  quantitySold: number;
  revenue: number;
}

export interface SalesByCategoryReport {
  rows: CategorySalesRow[];
  range: DateRange;
}

/** Uses Sale.completedAt (not createdAt) — same reasoning as getSalesSummaryReport: a sale can
 * sit PARKED long before it completes, so only COMPLETED sales within the range count. Products
 * without a category are grouped under an explicit "Uncategorized" bucket rather than dropped. */
export async function getSalesByCategory(range: DateRange): Promise<SalesByCategoryReport> {
  const groups = await prisma.saleLineItem.groupBy({
    by: ["productId"],
    where: { sale: { status: "COMPLETED", completedAt: { gte: range.from, lte: range.to } } },
    _sum: { quantity: true, lineTotal: true },
  });

  const productIds = groups.map((g) => g.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, categoryId: true, category: { select: { id: true, name: true } } },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  const byCategory = new Map<number | null, { categoryName: string; quantitySold: number; revenue: number }>();
  for (const g of groups) {
    const product = productById.get(g.productId);
    const categoryId = product?.category?.id ?? null;
    const categoryName = product?.category?.name ?? "Uncategorized";
    const entry = byCategory.get(categoryId) ?? { categoryName, quantitySold: 0, revenue: 0 };
    entry.quantitySold += Number(g._sum.quantity ?? 0);
    entry.revenue += Number(g._sum.lineTotal ?? 0);
    byCategory.set(categoryId, entry);
  }

  const rows: CategorySalesRow[] = Array.from(byCategory.entries())
    .map(([categoryId, v]) => ({
      categoryId,
      categoryName: v.categoryName,
      quantitySold: v.quantitySold,
      revenue: round2(v.revenue),
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return { rows, range };
}

// ---------- 3. Tax report ----------

export interface TaxReportRow {
  taxClassId: number | null;
  taxClassName: string;
  ratePercentage: number;
  taxCollected: number;
  salesCount: number;
}

export interface TaxReport {
  rows: TaxReportRow[];
  totalTaxCollected: number;
}

export async function getTaxReport(range: DateRange): Promise<TaxReport> {
  const groups = await prisma.sale.groupBy({
    by: ["taxClassId"],
    where: { status: "COMPLETED", completedAt: { gte: range.from, lte: range.to } },
    _sum: { taxTotal: true },
    _count: { _all: true },
  });

  const taxClasses = await prisma.taxClass.findMany({ select: { id: true, name: true, ratePercentage: true } });
  const byId = new Map(taxClasses.map((t) => [t.id, t]));

  const rows: TaxReportRow[] = groups
    .map((g) => {
      const tc = g.taxClassId !== null ? byId.get(g.taxClassId) : null;
      return {
        taxClassId: g.taxClassId,
        taxClassName: tc?.name ?? "No tax class",
        ratePercentage: tc ? Number(tc.ratePercentage) : 0,
        taxCollected: round2(Number(g._sum.taxTotal ?? 0)),
        salesCount: g._count._all,
      };
    })
    .sort((a, b) => b.taxCollected - a.taxCollected);

  return { rows, totalTaxCollected: round2(rows.reduce((sum, r) => sum + r.taxCollected, 0)) };
}

// ---------- 4. Void / refund report ----------

export interface VoidRow {
  saleId: number;
  receiptNumber: string;
  cashierName: string;
  grandTotal: number;
  createdAt: string;
}

export interface RefundRow {
  returnId: number;
  originalSaleId: number;
  originalReceiptNumber: string;
  processedByName: string;
  totalRefunded: number;
  reason: string | null;
  createdAt: string;
}

export interface VoidRefundReport {
  voids: VoidRow[];
  refunds: RefundRow[];
  voidTotal: number;
  refundTotal: number;
}

/**
 * VOIDED sales use createdAt (voids happen pre-completion — the free-void path — so
 * completedAt is always null on them). Returns (post-completion refunds) use their own
 * createdAt, which is always semantically correct since a Return is created once, at the
 * moment it's processed.
 */
export async function getVoidRefundReport(range: DateRange): Promise<VoidRefundReport> {
  const [voidedSales, returns] = await Promise.all([
    prisma.sale.findMany({
      where: { status: "VOIDED", createdAt: { gte: range.from, lte: range.to } },
      include: { cashier: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.return.findMany({
      where: { createdAt: { gte: range.from, lte: range.to } },
      include: {
        processedBy: { select: { name: true } },
        originalSale: { select: { id: true, receiptNumber: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const voids: VoidRow[] = voidedSales.map((s) => ({
    saleId: s.id,
    receiptNumber: s.receiptNumber,
    cashierName: s.cashier.name,
    grandTotal: s.grandTotal.toNumber(),
    createdAt: s.createdAt.toISOString(),
  }));

  const refunds: RefundRow[] = returns.map((r) => ({
    returnId: r.id,
    originalSaleId: r.originalSale.id,
    originalReceiptNumber: r.originalSale.receiptNumber,
    processedByName: r.processedBy.name,
    totalRefunded: r.totalRefunded.toNumber(),
    reason: r.reason,
    createdAt: r.createdAt.toISOString(),
  }));

  return {
    voids,
    refunds,
    voidTotal: round2(voids.reduce((s, v) => s + v.grandTotal, 0)),
    refundTotal: round2(refunds.reduce((s, r) => s + r.totalRefunded, 0)),
  };
}

// ---------- 4b. Completed sales eligible for a full-receipt cancellation ----------

export interface CancellableSaleRow {
  saleId: number;
  receiptNumber: string;
  cashierName: string;
  grandTotal: number;
  completedAt: string | null;
}

/**
 * COMPLETED sales in range, for the void-refund report's "Cancel receipt" action
 * (voidCompletedSale in app/actions/sales.ts). Kept separate from getVoidRefundReport
 * above — that one only ever queries sales already in a terminal VOIDED/refunded state,
 * this queries the *source* set an admin would pick a receipt to cancel from.
 */
export async function getCancellableSales(range: DateRange): Promise<CancellableSaleRow[]> {
  const sales = await prisma.sale.findMany({
    where: { status: "COMPLETED", completedAt: { gte: range.from, lte: range.to } },
    include: { cashier: { select: { name: true } } },
    orderBy: { completedAt: "desc" },
  });

  return sales.map((s) => ({
    saleId: s.id,
    receiptNumber: s.receiptNumber,
    cashierName: s.cashier.name,
    grandTotal: s.grandTotal.toNumber(),
    completedAt: s.completedAt ? s.completedAt.toISOString() : null,
  }));
}

// ---------- 5. Inventory valuation (point-in-time, no date range — see report notes) ----------

export interface ValuationRow {
  productId: number;
  variantId: number | null;
  productName: string;
  categoryName: string | null;
  sku: string;
  quantityOnHand: number;
  costPrice: number;
  value: number;
}

export interface InventoryValuationReport {
  rows: ValuationRow[];
  totalValue: number;
  byCategory: { category: string; value: number }[];
}

/** Current stock-on-hand x cost price at a location. This is a point-in-time snapshot —
 * Inventory only stores the current balance, not historical balances, so unlike the other
 * reports there's no meaningful "as of a past date" filter to apply here. */
export async function getInventoryValuationReport(
  locationId: number = DEFAULT_LOCATION_ID,
): Promise<InventoryValuationReport> {
  const inventoryRows = await prisma.inventory.findMany({
    where: { locationId },
    include: { product: { include: { category: { select: { name: true } } } }, variant: true },
  });

  const rows: ValuationRow[] = inventoryRows.map((inv) => {
    const qty = inv.quantityOnHand.toNumber();
    const cost = inv.product.costPrice.toNumber();
    return {
      productId: inv.productId,
      variantId: inv.variantId,
      productName: inv.variant ? `${inv.product.name} — ${inv.variant.name}` : inv.product.name,
      categoryName: inv.product.category?.name ?? null,
      sku: inv.variant?.sku ?? inv.product.sku,
      quantityOnHand: qty,
      costPrice: cost,
      value: round2(qty * cost),
    };
  });

  const totalValue = round2(rows.reduce((s, r) => s + r.value, 0));

  const byCategoryMap = new Map<string, number>();
  for (const r of rows) {
    const key = r.categoryName ?? "Uncategorized";
    byCategoryMap.set(key, (byCategoryMap.get(key) ?? 0) + r.value);
  }
  const byCategory = Array.from(byCategoryMap.entries())
    .map(([category, value]) => ({ category, value: round2(value) }))
    .sort((a, b) => b.value - a.value);

  return { rows: rows.sort((a, b) => b.value - a.value), totalValue, byCategory };
}

// ---------- 6. Inventory history (StockMovement ledger) ----------

export interface StockMovementRow {
  id: number;
  productId: number;
  productName: string;
  variantName: string | null;
  sku: string;
  quantityDelta: number;
  reason: StockMovementReason;
  referenceId: number | null;
  createdByName: string | null;
  createdAt: string;
}

export async function getInventoryHistoryReport(params: {
  range: DateRange;
  productId?: number;
  reason?: StockMovementReason;
  locationId?: number;
}): Promise<StockMovementRow[]> {
  const movements = await prisma.stockMovement.findMany({
    where: {
      createdAt: { gte: params.range.from, lte: params.range.to },
      ...(params.locationId ? { locationId: params.locationId } : {}),
      ...(params.productId ? { productId: params.productId } : {}),
      ...(params.reason ? { reason: params.reason } : {}),
    },
    include: { createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const productIds = [...new Set(movements.map((m) => m.productId))];
  const variantIds = [...new Set(movements.map((m) => m.variantId).filter((v): v is number => v !== null))];
  const [products, variants] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, sku: true } }),
    prisma.productVariant.findMany({ where: { id: { in: variantIds } }, select: { id: true, name: true, sku: true } }),
  ]);
  const productById = new Map(products.map((p) => [p.id, p]));
  const variantById = new Map(variants.map((v) => [v.id, v]));

  return movements.map((m) => {
    const product = productById.get(m.productId);
    const variant = m.variantId ? variantById.get(m.variantId) : null;
    return {
      id: m.id,
      productId: m.productId,
      productName: product?.name ?? `Product #${m.productId}`,
      variantName: variant?.name ?? null,
      sku: variant?.sku ?? product?.sku ?? "—",
      quantityDelta: m.quantityDelta.toNumber(),
      reason: m.reason,
      referenceId: m.referenceId,
      createdByName: m.createdBy?.name ?? null,
      createdAt: m.createdAt.toISOString(),
    };
  });
}

// ---------- 7. Shift reconciliation ----------

export interface ShiftReconciliationRow {
  id: number;
  cashierName: string;
  locationName: string;
  openedAt: string;
  closedAt: string | null;
  variance: number | null;
  expectedCash: number | null;
  closingCount: number | null;
}

/** Filters by Shift.openedAt within range — includes still-open shifts that started in the
 * window (variance/expectedCash null until closed) as well as closed ones. */
export async function getShiftReconciliationReport(range: DateRange): Promise<ShiftReconciliationRow[]> {
  const shifts = await prisma.shift.findMany({
    where: { openedAt: { gte: range.from, lte: range.to } },
    include: { cashier: { select: { name: true } }, location: { select: { name: true } } },
    orderBy: { openedAt: "desc" },
  });

  return shifts.map((s) => ({
    id: s.id,
    cashierName: s.cashier.name,
    locationName: s.location.name,
    openedAt: s.openedAt.toISOString(),
    closedAt: s.closedAt?.toISOString() ?? null,
    variance: s.variance ? s.variance.toNumber() : null,
    expectedCash: s.expectedCash ? s.expectedCash.toNumber() : null,
    closingCount: s.closingCount ? s.closingCount.toNumber() : null,
  }));
}

// ---------- 8. Per-product sales series (product detail page chart) ----------

export type ProductSeriesRange = "7d" | "30d" | "90d" | "12mo";

export const PRODUCT_SERIES_RANGES: { key: ProductSeriesRange; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "12mo", label: "12 months" },
];

export interface ProductSalesPoint {
  /** YYYY-MM-DD for daily buckets, YYYY-MM for monthly. */
  bucket: string;
  /** Short axis label, e.g. "14 Aug" or "Aug". */
  label: string;
  units: number;
  revenue: number;
}

export interface ProductSalesSeries {
  range: ProductSeriesRange;
  points: ProductSalesPoint[];
  totalUnits: number;
  totalRevenue: number;
  /** Same metrics for the immediately preceding window of equal length, for a "vs before" read. */
  previousUnits: number;
  previousRevenue: number;
}

export function parseProductSeriesRange(value: string | undefined): ProductSeriesRange {
  return PRODUCT_SERIES_RANGES.some((r) => r.key === value)
    ? (value as ProductSeriesRange)
    : "30d";
}

/** Bucket size and count for each range option. 12mo buckets by month, the rest by day. */
function seriesShape(range: ProductSeriesRange): { unit: "day" | "month"; count: number } {
  if (range === "7d") return { unit: "day", count: 7 };
  if (range === "30d") return { unit: "day", count: 30 };
  if (range === "90d") return { unit: "day", count: 90 };
  return { unit: "month", count: 12 };
}

/**
 * Buckets are addressed by their store-local calendar key ("2026-08-14" / "2026-08"),
 * never by a Date, so the JS-side fill loop and the SQL-side `to_char(date_trunc(...))`
 * are comparing the same strings. Anything Date-shaped here would drift by a timezone.
 */
function shiftBucketKey(key: string, unit: "day" | "month", steps: number): string {
  if (unit === "day") {
    const d = new Date(`${key}T12:00:00Z`); // midday: immune to DST edges
    d.setUTCDate(d.getUTCDate() + steps);
    return d.toISOString().slice(0, 10);
  }
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + steps, 1, 12));
  return d.toISOString().slice(0, 7);
}

/** Store-local key of the bucket `count` buckets back from (and including) today. */
function seriesStartKey(unit: "day" | "month", count: number): string {
  const todayKey = toStoreDateStr(new Date());
  const currentKey = unit === "day" ? todayKey : todayKey.slice(0, 7);
  return shiftBucketKey(currentKey, unit, -(count - 1));
}

function bucketLabel(key: string, unit: "day" | "month"): string {
  // Rendered from the key at midday UTC purely to get a month name / day number out of
  // Intl — the key itself is already the store-local calendar date.
  const d = new Date(unit === "day" ? `${key}T12:00:00Z` : `${key}-01T12:00:00Z`);
  return unit === "day"
    ? d.toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" })
    : d.toLocaleDateString(undefined, { month: "short", timeZone: "UTC" });
}

/**
 * Units sold and revenue for one product over time — "how is this product doing over the
 * last N days?" on the product detail page.
 *
 * Aggregated with date_trunc in SQL rather than pulling every line item and grouping in
 * JS: a fast-moving product over 12 months is a lot of rows to ship just to sum them.
 * Empty buckets are filled in afterwards so the line has a continuous shape instead of
 * silently skipping days with no sales.
 */
export async function getProductSalesSeries(
  productId: number,
  range: ProductSeriesRange,
): Promise<ProductSalesSeries> {
  const { unit, count } = seriesShape(range);
  const fromKey = seriesStartKey(unit, count);
  // Equal-length window immediately before `fromKey`, for the previous-period comparison.
  const previousFromKey = shiftBucketKey(fromKey, unit, -count);
  const previousFrom = storeInstant(
    unit === "day" ? previousFromKey : `${previousFromKey}-01`,
    "00:00:00.000",
  );

  // Bucket on the store's clock, and hand the key back as text: returning a timestamp and
  // re-parsing it in JS would reintroduce exactly the UTC/local drift this avoids.
  const keyFormat = unit === "day" ? "YYYY-MM-DD" : "YYYY-MM";
  const rows = await prisma.$queryRaw<{ bucket: string; units: number; revenue: number }[]>`
    SELECT to_char(
             date_trunc(${unit}, s."completedAt" AT TIME ZONE 'UTC' AT TIME ZONE ${STORE_TIME_ZONE}),
             ${keyFormat}
           )                           AS bucket,
           SUM(li.quantity)::float8    AS units,
           SUM(li."lineTotal")::float8 AS revenue
    FROM sale_line_items li
    JOIN sales s ON s.id = li."saleId"
    WHERE li."productId" = ${productId}
      AND s.status = 'COMPLETED'
      AND s."completedAt" >= ${previousFrom}
    GROUP BY 1
    ORDER BY 1`;

  const byBucket = new Map(rows.map((r) => [r.bucket, r]));

  const points: ProductSalesPoint[] = [];
  for (let i = 0; i < count; i++) {
    const key = shiftBucketKey(fromKey, unit, i);
    const row = byBucket.get(key);
    points.push({
      bucket: key,
      label: bucketLabel(key, unit),
      units: Number(row?.units ?? 0),
      revenue: round2(Number(row?.revenue ?? 0)),
    });
  }

  // Everything in the raw result before `fromKey` belongs to the previous window.
  let previousUnits = 0;
  let previousRevenue = 0;
  for (const r of rows) {
    if (r.bucket < fromKey) {
      previousUnits += Number(r.units ?? 0);
      previousRevenue += Number(r.revenue ?? 0);
    }
  }

  return {
    range,
    points,
    totalUnits: points.reduce((s, p) => s + p.units, 0),
    totalRevenue: round2(points.reduce((s, p) => s + p.revenue, 0)),
    previousUnits,
    previousRevenue: round2(previousRevenue),
  };
}

// ---------- 9. Dashboard: sales by hour of day ----------

export interface HourlySalesRow {
  hour: number;
  label: string;
  total: number;
  count: number;
}

/**
 * "What time of day does this store actually make money?" — completed sales bucketed by
 * the hour of completedAt, all 24 hours present so the quiet stretches are visible too.
 */
export async function getSalesByHour(range: DateRange): Promise<HourlySalesRow[]> {
  // completedAt is `timestamp without time zone` holding UTC, and the database session is
  // UTC — so it has to be re-anchored to UTC and then converted, or a 20:00 Manila sale
  // would be charted at 12:00.
  const rows = await prisma.$queryRaw<{ hour: number; total: number; count: number }[]>`
    SELECT EXTRACT(HOUR FROM (s."completedAt" AT TIME ZONE 'UTC' AT TIME ZONE ${STORE_TIME_ZONE}))::int AS hour,
           SUM(s."grandTotal")::float8 AS total,
           COUNT(*)::int               AS count
    FROM sales s
    WHERE s.status = 'COMPLETED'
      AND s."completedAt" >= ${range.from}
      AND s."completedAt" <= ${range.to}
    GROUP BY 1
    ORDER BY 1`;

  const byHour = new Map(rows.map((r) => [r.hour, r]));
  return Array.from({ length: 24 }, (_, hour) => {
    const row = byHour.get(hour);
    return {
      hour,
      label: String(hour).padStart(2, "0"),
      total: round2(Number(row?.total ?? 0)),
      count: Number(row?.count ?? 0),
    };
  });
}

// ---------- 10. Dashboard: stock at/below reorder point ----------

export interface ReorderAlertRow {
  productId: number;
  productName: string;
  variantName: string | null;
  sku: string;
  quantityOnHand: number;
  reorderThreshold: number;
  /** How far below the threshold this row sits — the reorder urgency. */
  shortfall: number;
}

/**
 * "What do I need to reorder right now?" — the same at/below-threshold definition the
 * Inventory page uses, ranked by how deep below the line each row is. Compares
 * inventory.quantityOnHand against products.reorderThreshold, a cross-table comparison
 * Prisma's `where` can't express, hence raw SQL.
 */
export async function getReorderAlerts(
  limit = 8,
  locationId: number = DEFAULT_LOCATION_ID,
): Promise<ReorderAlertRow[]> {
  const rows = await prisma.$queryRaw<
    {
      productId: number;
      productName: string;
      variantName: string | null;
      sku: string;
      quantityOnHand: number;
      reorderThreshold: number;
    }[]
  >`
    SELECT p.id                        AS "productId",
           p.name                      AS "productName",
           v.name                      AS "variantName",
           COALESCE(v.sku, p.sku)      AS sku,
           i."quantityOnHand"::float8  AS "quantityOnHand",
           p."reorderThreshold"        AS "reorderThreshold"
    FROM inventory i
    JOIN products p ON p.id = i."productId"
    LEFT JOIN product_variants v ON v.id = i."variantId"
    WHERE i."locationId" = ${locationId}
      AND p."trackStock"
      AND i."quantityOnHand" <= p."reorderThreshold"
    ORDER BY (p."reorderThreshold" - i."quantityOnHand") DESC, p.name ASC
    LIMIT ${limit}`;

  return rows.map((r) => ({
    ...r,
    quantityOnHand: Number(r.quantityOnHand),
    reorderThreshold: Number(r.reorderThreshold),
    shortfall: round2(Number(r.reorderThreshold) - Number(r.quantityOnHand)),
  }));
}

// ---------- 11. Dashboard: slow-moving stock ----------

export interface SlowMovingRow {
  productId: number;
  productName: string;
  sku: string;
  quantityOnHand: number;
  unitsSold: number;
  /** Stock on hand valued at cost — the cash actually sitting still. */
  stockValue: number;
}

/**
 * "Where is my money stuck?" — stock-tracked products still holding inventory that sold
 * nothing at all in the window, ranked by the cash value tied up in them (quantity x
 * cost). Ranking by value rather than by units is deliberate: ten unsold 500-peso items
 * matter more than a hundred unsold 5-peso ones.
 */
export async function getSlowMovingStock(
  range: DateRange,
  limit = 8,
  locationId: number = DEFAULT_LOCATION_ID,
): Promise<SlowMovingRow[]> {
  const rows = await prisma.$queryRaw<
    {
      productId: number;
      productName: string;
      sku: string;
      quantityOnHand: number;
      unitsSold: number;
      stockValue: number;
    }[]
  >`
    SELECT p.id                                         AS "productId",
           p.name                                       AS "productName",
           p.sku                                        AS sku,
           i."quantityOnHand"::float8                   AS "quantityOnHand",
           COALESCE(sold.units, 0)::float8              AS "unitsSold",
           (i."quantityOnHand" * p."costPrice")::float8 AS "stockValue"
    FROM inventory i
    JOIN products p ON p.id = i."productId"
    LEFT JOIN (
      SELECT li."productId" AS pid, SUM(li.quantity) AS units
      FROM sale_line_items li
      JOIN sales s ON s.id = li."saleId"
      WHERE s.status = 'COMPLETED'
        AND s."completedAt" >= ${range.from}
        AND s."completedAt" <= ${range.to}
      GROUP BY 1
    ) sold ON sold.pid = p.id
    WHERE i."locationId" = ${locationId}
      AND i."variantId" IS NULL
      AND p."trackStock"
      AND p."isActive"
      AND i."quantityOnHand" > 0
      AND COALESCE(sold.units, 0) = 0
    ORDER BY "stockValue" DESC, p.name ASC
    LIMIT ${limit}`;

  return rows.map((r) => ({
    ...r,
    quantityOnHand: Number(r.quantityOnHand),
    unitsSold: Number(r.unitsSold),
    stockValue: round2(Number(r.stockValue)),
  }));
}
