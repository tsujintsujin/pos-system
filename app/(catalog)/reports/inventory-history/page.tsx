import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  parseDateRange,
  parseStockMovementReason,
  getInventoryHistoryReport,
  STOCK_MOVEMENT_REASONS,
  DEFAULT_LOCATION_ID,
} from "@/lib/reports";
import ReportDateFilter from "@/app/components/ReportDateFilter";
import PageHeader from "@/app/components/ui/PageHeader";
import Card from "@/app/components/ui/Card";
import Select from "@/app/components/ui/Select";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/app/components/ui/Table";
import ProductLink from "@/app/components/ui/ProductLink";

export default async function InventoryHistoryReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; productId?: string; reason?: string }>;
}) {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    redirect(`/dashboard?error=${encodeURIComponent(gate.message)}`);
  }

  const sp = await searchParams;
  const range = parseDateRange(sp);
  const reason = parseStockMovementReason(sp.reason);
  const productId = sp.productId ? Number(sp.productId) : undefined;

  const [rows, products] = await Promise.all([
    getInventoryHistoryReport({
      range,
      productId: productId && !Number.isNaN(productId) ? productId : undefined,
      reason,
      locationId: DEFAULT_LOCATION_ID,
    }),
    prisma.product.findMany({ select: { id: true, name: true, sku: true }, orderBy: { name: "asc" } }),
  ]);

  const csvParams = new URLSearchParams({ from: range.fromStr, to: range.toStr });
  if (productId) csvParams.set("productId", String(productId));
  if (reason) csvParams.set("reason", reason);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Inventory history" backHref="/reports" backLabel="Reports" />

      <ReportDateFilter
        fromStr={range.fromStr}
        toStr={range.toStr}
        csvHref={`/api/reports/inventory-history/csv?${csvParams.toString()}`}
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="productId" className="text-xs font-medium text-text-muted">
            Product
          </label>
          <Select id="productId" name="productId" defaultValue={productId ?? ""} className="w-56">
            <option value="">All products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku})
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="reason" className="text-xs font-medium text-text-muted">
            Reason
          </label>
          <Select id="reason" name="reason" defaultValue={reason ?? ""} className="w-44">
            <option value="">All reasons</option>
            {STOCK_MOVEMENT_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </div>
      </ReportDateFilter>

      <Card className="p-0">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Date</TableHeaderCell>
              <TableHeaderCell>Product</TableHeaderCell>
              <TableHeaderCell>Reason</TableHeaderCell>
              <TableHeaderCell className="text-right">Delta</TableHeaderCell>
              <TableHeaderCell>Ref</TableHeaderCell>
              <TableHeaderCell>By</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-text-muted">
                  No stock movements match these filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-text-muted">{new Date(m.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <ProductLink productId={m.productId}>{m.productName}</ProductLink>
                    {m.variantName && <span className="text-text-muted"> — {m.variantName}</span>}
                    <span className="text-text-muted"> ({m.sku})</span>
                  </TableCell>
                  <TableCell className="text-text-muted">{m.reason}</TableCell>
                  <TableCell
                    className={`text-right font-medium ${m.quantityDelta >= 0 ? "text-success" : "text-danger"}`}
                  >
                    {m.quantityDelta > 0 ? "+" : ""}
                    {m.quantityDelta}
                  </TableCell>
                  <TableCell className="text-text-muted">{m.referenceId ?? "—"}</TableCell>
                  <TableCell className="text-text-muted">{m.createdByName ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
