import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { parseDateRange, getTaxReport } from "@/lib/reports";
import ReportDateFilter from "@/app/components/ReportDateFilter";
import PageHeader from "@/app/components/ui/PageHeader";
import Card from "@/app/components/ui/Card";
import StatCard from "@/app/components/ui/StatCard";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/app/components/ui/Table";

export default async function TaxReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    redirect(`/dashboard?error=${encodeURIComponent(gate.message)}`);
  }

  const sp = await searchParams;
  const range = parseDateRange(sp);
  const report = await getTaxReport(range);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Tax report" backHref="/reports" backLabel="Reports" />

      <ReportDateFilter
        fromStr={range.fromStr}
        toStr={range.toStr}
        csvHref={`/api/reports/tax/csv?from=${range.fromStr}&to=${range.toStr}`}
      />

      <StatCard label="Total tax collected" value={`₱${report.totalTaxCollected.toFixed(2)}`} className="max-w-xs" />

      <Card className="p-0">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-heading text-sm font-semibold text-text">By tax class</h2>
        </div>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Tax class</TableHeaderCell>
              <TableHeaderCell className="text-right">Rate</TableHeaderCell>
              <TableHeaderCell className="text-right">Sales count</TableHeaderCell>
              <TableHeaderCell className="text-right">Tax collected</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {report.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-text-muted">
                  No completed sales in this range.
                </TableCell>
              </TableRow>
            ) : (
              report.rows.map((r) => (
                <TableRow key={r.taxClassId ?? "none"}>
                  <TableCell>{r.taxClassName}</TableCell>
                  <TableCell className="text-right text-text-muted">
                    {r.taxClassId ? `${r.ratePercentage}%` : "—"}
                  </TableCell>
                  <TableCell className="text-right">{r.salesCount}</TableCell>
                  <TableCell className="text-right font-medium">₱{r.taxCollected.toFixed(2)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
