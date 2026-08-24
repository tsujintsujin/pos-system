import Link from "next/link";
import { prisma } from "@/lib/prisma";
import Banner from "@/app/components/Banner";
import { LinkButton } from "@/app/components/ui/Button";
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

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;

  const purchaseOrders = await prisma.purchaseOrder.findMany({
    include: {
      supplier: { select: { name: true } },
      location: { select: { name: true } },
      _count: { select: { lineItems: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Purchase orders"
        subtitle={`${purchaseOrders.length} order${purchaseOrders.length === 1 ? "" : "s"}`}
        actions={
          <>
            <LinkButton href="/suppliers" variant="secondary" size="sm">
              Suppliers
            </LinkButton>
            <LinkButton href="/purchase-orders/new" size="sm">
              New purchase order
            </LinkButton>
          </>
        }
      />

      <Banner error={params.error} success={params.success} />

      {purchaseOrders.length === 0 ? (
        <EmptyState message="No purchase orders yet" subMessage="Create one to get started." />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>PO #</TableHeaderCell>
              <TableHeaderCell>Supplier</TableHeaderCell>
              <TableHeaderCell>Location</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell className="text-right">Lines</TableHeaderCell>
              <TableHeaderCell>Expected</TableHeaderCell>
              <TableHeaderCell>Created</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {purchaseOrders.map((po) => (
              <TableRow key={po.id}>
                <TableCell>
                  <Link
                    href={`/purchase-orders/${po.id}`}
                    className="cursor-pointer font-medium text-text transition-colors duration-150 hover:text-primary hover:underline"
                  >
                    #{po.id}
                  </Link>
                </TableCell>
                <TableCell>{po.supplier.name}</TableCell>
                <TableCell className="text-text-muted">{po.location.name}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANTS[po.status] ?? "neutral"}>{po.status}</Badge>
                </TableCell>
                <TableCell className="text-right">{po._count.lineItems}</TableCell>
                <TableCell className="text-text-muted">
                  {po.expectedDate ? new Date(po.expectedDate).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell className="text-text-muted">{new Date(po.createdAt).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
