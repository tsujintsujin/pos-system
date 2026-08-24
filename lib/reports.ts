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

function toDateInputStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Parse `from`/`to` (YYYY-MM-DD) query params into a Date range. Defaults to the last 7 days
 * (inclusive of today) when absent or unparseable. `to` is normalized to end-of-day so the
 * range is inclusive of the whole day picked, not just midnight.
 */
export function parseDateRange(params: { from?: string; to?: string }): DateRange {
  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setDate(defaultFrom.getDate() - 6);
  const defaultFromStr = toDateInputStr(defaultFrom);
  const defaultToStr = toDateInputStr(today);

  const fromStr = params.from && !Number.isNaN(Date.parse(params.from)) ? params.from : defaultFromStr;
  const toStr = params.to && !Number.isNaN(Date.parse(params.to)) ? params.to : defaultToStr;

  return {
    from: new Date(`${fromStr}T00:00:00`),
    to: new Date(`${toStr}T23:59:59.999`),
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
    const day = s.completedAt!.toISOString().slice(0, 10);
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
