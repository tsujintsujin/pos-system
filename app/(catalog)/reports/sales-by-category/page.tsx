import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { parseDateRange, getSalesByCategory } from "@/lib/reports";
import ReportDateFilter from "@/app/components/ReportDateFilter";
import PageHeader from "@/app/components/ui/PageHeader";
import Card from "@/app/components/ui/Card";
import StatCard from "@/app/components/ui/StatCard";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/app/components/ui/Table";

export default async function SalesByCategoryReportPage({
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
  const report = await getSalesByCategory(range);

  const totalRevenue = report.rows.reduce((sum, r) => sum + r.revenue, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Sales by category" backHref="/reports" backLabel="Reports" />

      <ReportDateFilter
        fromStr={range.fromStr}
        toStr={range.toStr}
        csvHref={`/api/reports/sales-by-category/csv?from=${range.fromStr}&to=${range.toStr}`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Categories with sales" value={report.rows.length} />
        <StatCard label="Total revenue" value={`₱${totalRevenue.toFixed(2)}`} />
      </div>

      <Card className="p-0">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-heading text-sm font-semibold text-text">By category</h2>
        </div>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Category</TableHeaderCell>
              <TableHeaderCell className="text-right">Qty sold</TableHeaderCell>
              <TableHeaderCell className="text-right">Revenue</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {report.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-6 text-center text-text-muted">
                  No sales in this range.
                </TableCell>
              </TableRow>
            ) : (
              report.rows.map((r) => (
                <TableRow key={r.categoryId ?? "uncategorized"}>
                  <TableCell>{r.categoryName}</TableCell>
                  <TableCell className="text-right">{r.quantitySold}</TableCell>
                  <TableCell className="text-right font-medium">₱{r.revenue.toFixed(2)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
