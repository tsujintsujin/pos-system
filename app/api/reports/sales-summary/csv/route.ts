import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { parseDateRange, getSalesSummaryReport } from "@/lib/reports";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET(request: NextRequest) {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    return NextResponse.json({ error: gate.message }, { status: gate.status });
  }

  const sp = request.nextUrl.searchParams;
  const range = parseDateRange({ from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined });
  const report = await getSalesSummaryReport(range);

  const lines: string[] = [];
  lines.push(
    toCsv(
      ["Metric", "Value"],
      [
        ["Total sales", report.totalSales],
        ["Transaction count", report.transactionCount],
        ["Average sale", report.averageSale],
      ],
    ),
  );
  lines.push("");
  lines.push(
    toCsv(
      ["Date", "Transactions", "Total"],
      report.byDay.map((d) => [d.date, d.count, d.total]),
    ),
  );
  lines.push("");
  lines.push(
    toCsv(
      ["Payment method", "Total"],
      report.byPaymentMethod.map((m) => [m.method, m.total]),
    ),
  );

  return csvResponse(lines.join("\n"), `sales-summary_${range.fromStr}_${range.toStr}.csv`);
}
