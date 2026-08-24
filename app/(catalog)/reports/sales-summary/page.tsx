import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { parseDateRange, getSalesSummaryReport } from "@/lib/reports";
import ReportDateFilter from "@/app/components/ReportDateFilter";
import PageHeader from "@/app/components/ui/PageHeader";
import Card from "@/app/components/ui/Card";
import StatCard from "@/app/components/ui/StatCard";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/app/components/ui/Table";

export default async function SalesSummaryReportPage({
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
  const report = await getSalesSummaryReport(range);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Sales summary" backHref="/reports" backLabel="Reports" />

      <ReportDateFilter
        fromStr={range.fromStr}
        toStr={range.toStr}
        csvHref={`/api/reports/sales-summary/csv?from=${range.fromStr}&to=${range.toStr}`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total sales" value={`₱${report.totalSales.toFixed(2)}`} />
        <StatCard label="Transactions" value={report.transactionCount} />
        <StatCard label="Average sale" value={`₱${report.averageSale.toFixed(2)}`} />
      </div>

      <Card className="p-0">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-heading text-sm font-semibold text-text">By day</h2>
        </div>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Date</TableHeaderCell>
              <TableHeaderCell className="text-right">Transactions</TableHeaderCell>
              <TableHeaderCell className="text-right">Total</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {report.byDay.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-6 text-center text-text-muted">
                  No completed sales in this range.
                </TableCell>
              </TableRow>
            ) : (
              report.byDay.map((d) => (
                <TableRow key={d.date}>
                  <TableCell>{d.date}</TableCell>
                  <TableCell className="text-right">{d.count}</TableCell>
                  <TableCell className="text-right font-medium">₱{d.total.toFixed(2)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Card className="p-0">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-heading text-sm font-semibold text-text">By payment method</h2>
        </div>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Method</TableHeaderCell>
              <TableHeaderCell className="text-right">Total</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {report.byPaymentMethod.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="py-6 text-center text-text-muted">
                  No payments in this range.
                </TableCell>
              </TableRow>
            ) : (
              report.byPaymentMethod.map((m) => (
                <TableRow key={m.method}>
                  <TableCell>{m.method}</TableCell>
                  <TableCell className="text-right font-medium">₱{m.total.toFixed(2)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
