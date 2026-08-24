import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { parseDateRange, getVoidRefundReport } from "@/lib/reports";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET(request: NextRequest) {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    return NextResponse.json({ error: gate.message }, { status: gate.status });
  }

  const sp = request.nextUrl.searchParams;
  const range = parseDateRange({ from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined });
  const report = await getVoidRefundReport(range);

  const lines: string[] = [];
  lines.push("Voided sales");
  lines.push(
    toCsv(
      ["Receipt #", "Cashier", "Amount", "Voided at"],
      report.voids.map((v) => [v.receiptNumber, v.cashierName, v.grandTotal, v.createdAt]),
    ),
  );
  lines.push("");
  lines.push("Returns");
  lines.push(
    toCsv(
      ["Original receipt #", "Processed by", "Refunded", "Reason", "Date"],
      report.refunds.map((r) => [r.originalReceiptNumber, r.processedByName, r.totalRefunded, r.reason, r.createdAt]),
    ),
  );

  return csvResponse(lines.join("\n"), `void-refund_${range.fromStr}_${range.toStr}.csv`);
}
