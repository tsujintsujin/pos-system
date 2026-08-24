import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { parseDateRange, getProductPerformanceReport, type ProductPerformanceRow } from "@/lib/reports";
import ReportDateFilter from "@/app/components/ReportDateFilter";
import PageHeader from "@/app/components/ui/PageHeader";
import Card from "@/app/components/ui/Card";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/app/components/ui/Table";

export default async function ProductPerformanceReportPage({
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
  const report = await getProductPerformanceReport(range);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Product performance" backHref="/reports" backLabel="Reports" />

      <ReportDateFilter
        fromStr={range.fromStr}
        toStr={range.toStr}
        csvHref={`/api/reports/product-performance/csv?from=${range.fromStr}&to=${range.toStr}`}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RankTable title="Best sellers by quantity" rows={report.byQuantityDesc.slice(0, 10)} metric="qty" />
        <RankTable title="Worst sellers by quantity" rows={report.byQuantityAsc.slice(0, 10)} metric="qty" />
        <RankTable title="Best sellers by revenue" rows={report.byRevenueDesc.slice(0, 10)} metric="revenue" />
        <RankTable title="Worst sellers by revenue" rows={report.byRevenueAsc.slice(0, 10)} metric="revenue" />
      </div>
    </div>
  );
}

function RankTable({
  title,
  rows,
  metric,
}: {
  title: string;
  rows: ProductPerformanceRow[];
  metric: "qty" | "revenue";
}) {
  return (
    <Card className="p-0">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-heading text-sm font-semibold text-text">{title}</h2>
      </div>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Product</TableHeaderCell>
            <TableHeaderCell className="text-right">{metric === "qty" ? "Qty sold" : "Revenue"}</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={2} className="py-6 text-center text-text-muted">
                No sales in this range.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.productId}>
                <TableCell>
                  {r.name} <span className="text-text-muted">({r.sku})</span>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {metric === "qty" ? r.quantitySold : `₱${r.revenue.toFixed(2)}`}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
