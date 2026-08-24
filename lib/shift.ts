import { prisma } from "@/lib/prisma";

export const DEFAULT_LOCATION_ID = 1;
export const DEFAULT_REGISTER_ID = 1;

/** Minimal shape both `prisma` and a `$transaction` callback's `tx` client satisfy. */
type QueryClient = Pick<typeof prisma, "shift" | "payment" | "sale" | "cashMovement">;

/** The cashier's currently open shift (closedAt null), if any. One open shift per user at a time. */
export async function getActiveShift(userId: number) {
  return prisma.shift.findFirst({
    where: { cashierId: userId, closedAt: null },
    orderBy: { openedAt: "desc" },
  });
}

export interface ShiftSummary {
  shiftId: number;
  openingFloat: number;
  salesCount: number;
  salesByMethod: Record<string, number>;
  grossSalesTotal: number;
  paidIn: number;
  paidOut: number;
  safeDrop: number;
  expectedCash: number;
}

/**
 * Cash-drawer math shared by the X-report (open shift, read-only), the close-shift action
 * (which persists expectedCash/variance), and the Z-report (closed shift, read-only).
 * expectedCash = openingFloat + cash sales during this shift + paid-in − paid-out − safe-drops.
 * Only COMPLETED sales count — PARKED/VOIDED sales never had a payment recorded.
 */
export async function getShiftSummary(client: QueryClient, shiftId: number): Promise<ShiftSummary | null> {
  const shift = await client.shift.findUnique({ where: { id: shiftId } });
  if (!shift) return null;

  const payments = await client.payment.findMany({
    where: { sale: { shiftId, status: "COMPLETED" } },
    include: { paymentMethod: true },
  });

  const salesByMethod: Record<string, number> = {};
  let grossSalesTotal = 0;
  for (const p of payments) {
    const amount = Number(p.amount);
    salesByMethod[p.paymentMethod.name] = (salesByMethod[p.paymentMethod.name] ?? 0) + amount;
    grossSalesTotal += amount;
  }

  const salesCount = await client.sale.count({ where: { shiftId, status: "COMPLETED" } });

  const movements = await client.cashMovement.findMany({ where: { shiftId } });
  let paidIn = 0;
  let paidOut = 0;
  let safeDrop = 0;
  for (const m of movements) {
    const amount = Number(m.amount);
    if (m.type === "PAID_IN") paidIn += amount;
    else if (m.type === "PAID_OUT") paidOut += amount;
    else if (m.type === "SAFE_DROP") safeDrop += amount;
  }

  const openingFloat = Number(shift.openingFloat);
  const cashSales = salesByMethod["Cash"] ?? 0;
  const expectedCash = round2(openingFloat + cashSales + paidIn - paidOut - safeDrop);

  return {
    shiftId,
    openingFloat,
    salesCount,
    salesByMethod,
    grossSalesTotal: round2(grossSalesTotal),
    paidIn: round2(paidIn),
    paidOut: round2(paidOut),
    safeDrop: round2(safeDrop),
    expectedCash,
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
