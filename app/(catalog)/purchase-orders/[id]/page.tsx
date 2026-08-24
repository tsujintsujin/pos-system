import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  addPurchaseOrderLineItem,
  removePurchaseOrderLineItem,
  markPurchaseOrderOrdered,
  cancelPurchaseOrder,
  receivePurchaseOrderLineItem,
} from "@/app/actions/purchase-orders";
import Banner from "@/app/components/Banner";
import Card from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Select from "@/app/components/ui/Select";
import Button from "@/app/components/ui/Button";
import PageHeader from "@/app/components/ui/PageHeader";
import Badge, { type BadgeVariant } from "@/app/components/ui/Badge";
import EmptyState from "@/app/components/ui/EmptyState";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/app/components/ui/Table";

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  DRAFT: "neutral",
  ORDERED: "info",
  PARTIAL: "warning",
  RECEIVED: "success",
  CANCELLED: "danger",
};

export default async function PurchaseOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { id: idParam } = await params;
  const sp = await searchParams;
  const id = Number(idParam);
  if (Number.isNaN(id)) notFound();

  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      location: true,
      lineItems: {
        include: { product: { select: { id: true, sku: true, name: true } } },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!po) notFound();

  const canEditLines = po.status === "DRAFT" || po.status === "ORDERED";
  const canReceive = po.status === "ORDERED" || po.status === "PARTIAL";
  const canMarkOrdered = po.status === "DRAFT" && po.lineItems.length > 0;
  const canCancel =
    (po.status === "DRAFT" || po.status === "ORDERED") &&
    po.lineItems.every((l) => l.quantityReceived.toNumber() === 0);

  // Products already selectable as line items — for a leaner add-line dropdown, exclude
  // ones already on this PO isn't required (re-ordering the same product on a second line
  // is fine), so just list everything active.
  const products = canEditLines
    ? await prisma.product.findMany({
        where: { isActive: true },
        select: { id: true, sku: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Purchase order #${po.id}`}
        subtitle={
          <>
            {po.supplier.name} · Location: {po.location.name}
            {po.expectedDate && <> · Expected: {new Date(po.expectedDate).toLocaleDateString()}</>}
          </>
        }
        backHref="/purchase-orders"
        backLabel="Back to purchase orders"
      />

      <Banner error={sp.error} success={sp.success} />

      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={STATUS_VARIANTS[po.status] ?? "neutral"} className="text-sm">
          {po.status}
        </Badge>

        {canMarkOrdered && (
          <form action={markPurchaseOrderOrdered.bind(null, po.id)}>
            <Button type="submit">Mark as ordered</Button>
          </form>
        )}

        {canCancel && (
          <form action={cancelPurchaseOrder.bind(null, po.id)}>
            <Button type="submit" variant="danger">
              Cancel purchase order
            </Button>
          </form>
        )}
      </div>

      <Card className="p-0">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-text">Line items</h2>
        </div>
        {po.lineItems.length === 0 ? (
          <div className="px-4 py-2">
            <EmptyState message="No line items yet" />
          </div>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Product</TableHeaderCell>
                <TableHeaderCell className="text-right">Ordered</TableHeaderCell>
                <TableHeaderCell className="text-right">Received</TableHeaderCell>
                <TableHeaderCell className="text-right">Remaining</TableHeaderCell>
                <TableHeaderCell className="text-right">Unit cost</TableHeaderCell>
                {canReceive && <TableHeaderCell>Receive</TableHeaderCell>}
                {canEditLines && <TableHeaderCell />}
              </TableRow>
            </TableHead>
            <TableBody>
              {po.lineItems.map((l) => {
                const ordered = l.quantityOrdered.toNumber();
                const received = l.quantityReceived.toNumber();
                const remaining = Math.max(0, ordered - received);
                const fullyReceived = remaining <= 0;
                return (
                  <TableRow key={l.id}>
                    <TableCell>
                      {l.product.name} <span className="text-text-muted">({l.product.sku})</span>
                    </TableCell>
                    <TableCell className="text-right">{ordered}</TableCell>
                    <TableCell className="text-right">{received}</TableCell>
                    <TableCell className="text-right">
                      <span className={fullyReceived ? "text-success" : "text-warning"}>{remaining}</span>
                    </TableCell>
                    <TableCell className="text-right">₱{l.unitCost.toFixed(2)}</TableCell>
                    {canReceive && (
                      <TableCell>
                        {fullyReceived ? (
                          <Badge variant="success">Fully received</Badge>
                        ) : (
                          <form
                            action={receivePurchaseOrderLineItem.bind(null, po.id, l.id)}
                            className="flex items-center gap-2"
                          >
                            <Input
                              type="number"
                              name="quantity"
                              step="0.001"
                              min="0.001"
                              max={remaining}
                              defaultValue={remaining}
                              required
                              className="w-24 min-h-9 py-1 text-xs"
                            />
                            <Button type="submit" size="sm">
                              Receive
                            </Button>
                          </form>
                        )}
                      </TableCell>
                    )}
                    {canEditLines && (
                      <TableCell className="text-right">
                        {received === 0 && (
                          <form action={removePurchaseOrderLineItem.bind(null, po.id, l.id)}>
                            <Button type="submit" variant="danger" size="sm">
                              Remove
                            </Button>
                          </form>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {canEditLines && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-text">Add line item</h2>
          {products.length === 0 ? (
            <p className="text-sm text-text-muted">No active products available.</p>
          ) : (
            <form action={addPurchaseOrderLineItem.bind(null, po.id)} className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="productId" className="text-xs font-medium text-text-muted">
                  Product
                </label>
                <Select id="productId" name="productId" required className="w-64">
                  <option value="">Select a product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="quantityOrdered" className="text-xs font-medium text-text-muted">
                  Quantity ordered
                </label>
                <Input
                  id="quantityOrdered"
                  name="quantityOrdered"
                  type="number"
                  step="0.001"
                  min="0.001"
                  required
                  className="w-32"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="unitCost" className="text-xs font-medium text-text-muted">
                  Unit cost
                </label>
                <Input id="unitCost" name="unitCost" type="number" step="0.01" min="0" required className="w-32" />
              </div>
              <Button type="submit">Add line item</Button>
            </form>
          )}
        </Card>
      )}
    </div>
  );
}
