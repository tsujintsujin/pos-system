import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { parseDateRange, getShiftReconciliationReport } from "@/lib/reports";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET(request: NextRequest) {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    return NextResponse.json({ error: gate.message }, { status: gate.status });
  }

  const sp = request.nextUrl.searchParams;
  const range = parseDateRange({ from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined });
  const rows = await getShiftReconciliationReport(range);

  const csv = toCsv(
    ["Shift #", "Cashier", "Location", "Opened", "Closed", "Expected cash", "Counted", "Variance"],
    rows.map((s) => [
      s.id,
      s.cashierName,
      s.locationName,
      s.openedAt,
      s.closedAt,
      s.expectedCash,
      s.closingCount,
      s.variance,
    ]),
  );

  return csvResponse(csv, `shift-reconciliation_${range.fromStr}_${range.toStr}.csv`);
}
