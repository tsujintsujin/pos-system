import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  parseDateRange,
  parseStockMovementReason,
  getInventoryHistoryReport,
  DEFAULT_LOCATION_ID,
} from "@/lib/reports";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET(request: NextRequest) {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    return NextResponse.json({ error: gate.message }, { status: gate.status });
  }

  const sp = request.nextUrl.searchParams;
  const range = parseDateRange({ from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined });
  const reason = parseStockMovementReason(sp.get("reason") ?? undefined);
  const productIdRaw = sp.get("productId");
  const productId = productIdRaw ? Number(productIdRaw) : undefined;

  const rows = await getInventoryHistoryReport({
    range,
    productId: productId && !Number.isNaN(productId) ? productId : undefined,
    reason,
    locationId: DEFAULT_LOCATION_ID,
  });

  const csv = toCsv(
    ["Date", "SKU", "Product", "Reason", "Delta", "Reference", "By"],
    rows.map((m) => [
      m.createdAt,
      m.sku,
      m.variantName ? `${m.productName} — ${m.variantName}` : m.productName,
      m.reason,
      m.quantityDelta,
      m.referenceId,
      m.createdByName,
    ]),
  );

  return csvResponse(csv, `inventory-history_${range.fromStr}_${range.toStr}.csv`);
}
