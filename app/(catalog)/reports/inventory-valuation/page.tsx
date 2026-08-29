import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getInventoryValuationReport, DEFAULT_LOCATION_ID } from "@/lib/reports";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/app/components/ui/PageHeader";
import Card from "@/app/components/ui/Card";
import StatCard from "@/app/components/ui/StatCard";
import { LinkButton } from "@/app/components/ui/Button";
import { DownloadIcon } from "@/app/components/ui/icons";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/app/components/ui/Table";
import ProductLink from "@/app/components/ui/ProductLink";

export default async function InventoryValuationReportPage() {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    redirect(`/dashboard?error=${encodeURIComponent(gate.message)}`);
  }

  const [report, location] = await Promise.all([
    getInventoryValuationReport(DEFAULT_LOCATION_ID),
    prisma.location.findUnique({ where: { id: DEFAULT_LOCATION_ID }, select: { name: true } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Inventory valuation — ${location?.name ?? "Main Store"}`}
        backHref="/reports"
        backLabel="Reports"
      />

      {/* Point-in-time snapshot — no date-range filter, intentionally. There is no
          historical daily inventory balance in the schema, only current stock on
          hand x cost price, so a date range wouldn't have anything to filter. */}
      <p className="rounded-md bg-bg px-4 py-3 text-xs text-text-muted">
        This is a current, point-in-time snapshot (stock on hand × cost price) — there is no
        historical daily inventory balance in the schema, so unlike the other reports this one
        has no date-range filter.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatCard label="Total inventory value" value={`₱${report.totalValue.toFixed(2)}`} className="min-w-56" />
        <LinkButton href="/api/reports/inventory-valuation/csv" variant="secondary">
          <DownloadIcon className="h-4 w-4" />
          Export CSV
        </LinkButton>
      </div>

      <Card className="p-0">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-heading text-sm font-semibold text-text">By category</h2>
        </div>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Category</TableHeaderCell>
              <TableHeaderCell className="text-right">Value</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {report.byCategory.map((c) => (
              <TableRow key={c.category}>
                <TableCell>{c.category}</TableCell>
                <TableCell className="text-right font-medium">₱{c.value.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card className="p-0">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-heading text-sm font-semibold text-text">By product</h2>
        </div>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Product</TableHeaderCell>
              <TableHeaderCell>SKU</TableHeaderCell>
              <TableHeaderCell className="text-right">On hand</TableHeaderCell>
              <TableHeaderCell className="text-right">Cost price</TableHeaderCell>
              <TableHeaderCell className="text-right">Value</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {report.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-text-muted">
                  No inventory at this location.
                </TableCell>
              </TableRow>
            ) : (
              report.rows.map((r) => (
                <TableRow key={`${r.productId}_${r.variantId ?? "base"}`}>
                  <TableCell>
                    <ProductLink productId={r.productId}>{r.productName}</ProductLink>
                  </TableCell>
                  <TableCell className="text-text-muted">{r.sku}</TableCell>
                  <TableCell className="text-right">{r.quantityOnHand}</TableCell>
                  <TableCell className="text-right">₱{r.costPrice.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-medium">₱{r.value.toFixed(2)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
