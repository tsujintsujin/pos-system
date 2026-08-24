/**
 * Sequential, never-reused receipt numbers.
 *
 * Scheme: `L{locationId}-R{registerId}-{saleId padded to 6 digits}`, e.g. "L1-R1-000042".
 * Sale.id is a MySQL auto-increment column, so it is already guaranteed unique and
 * monotonically sequential — reusing it means no separate counter table is needed, and a
 * voided sale's number can never be recycled because the id itself never is.
 *
 * Real receipt numbers are only assigned at completion time (see completeSale in
 * app/actions/sales.ts). PARKED sales get a throwaway placeholder (see
 * placeholderReceiptNumber) purely to satisfy the DB's non-null unique constraint on
 * Sale.receiptNumber — it is never shown to a customer and is overwritten on completion.
 */
export function buildReceiptNumber(locationId: number, registerId: number, saleId: number): string {
  return `L${locationId}-R${registerId}-${String(saleId).padStart(6, "0")}`;
}

/** Unique placeholder for a Sale row that hasn't been completed yet (PARKED). Never customer-facing. */
export function placeholderReceiptNumber(): string {
  return `PARK-${crypto.randomUUID()}`;
}
