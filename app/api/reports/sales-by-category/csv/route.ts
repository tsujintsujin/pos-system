import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { parseDateRange, getSalesByCategory } from "@/lib/reports";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET(request: NextRequest) {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    return NextResponse.json({ error: gate.message }, { status: gate.status });
  }

  const sp = request.nextUrl.searchParams;
  const range = parseDateRange({ from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined });
  const report = await getSalesByCategory(range);

  const csv = toCsv(
    ["Category", "Quantity sold", "Revenue"],
    report.rows.map((r) => [r.categoryName, r.quantitySold, r.revenue]),
  );

  return csvResponse(csv, `sales-by-category_${range.fromStr}_${range.toStr}.csv`);
}
