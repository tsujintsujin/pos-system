import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { parseDateRange, getTaxReport } from "@/lib/reports";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET(request: NextRequest) {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    return NextResponse.json({ error: gate.message }, { status: gate.status });
  }

  const sp = request.nextUrl.searchParams;
  const range = parseDateRange({ from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined });
  const report = await getTaxReport(range);

  const csv = toCsv(
    ["Tax class", "Rate %", "Sales count", "Tax collected"],
    report.rows.map((r) => [r.taxClassName, r.ratePercentage, r.salesCount, r.taxCollected]),
  );

  return csvResponse(csv, `tax-report_${range.fromStr}_${range.toStr}.csv`);
}
