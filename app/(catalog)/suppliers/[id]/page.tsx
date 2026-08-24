import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { updateSupplier } from "@/app/actions/suppliers";
import Banner from "@/app/components/Banner";
import Card from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Button, { LinkButton } from "@/app/components/ui/Button";
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

export default async function SupplierProfilePage({
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

  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      purchaseOrders: {
        orderBy: { createdAt: "desc" },
        include: { location: { select: { name: true } } },
      },
    },
  });
  if (!supplier) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Supplier" subtitle={supplier.name} backHref="/suppliers" backLabel="Back to suppliers" />

      <Banner error={sp.error} success={sp.success} />

      <Card>
        <form action={updateSupplier.bind(null, supplier.id)} className="flex max-w-xl flex-col gap-4">
          <Field label="Name" name="name" required defaultValue={supplier.name} />
          <Field label="Contact info" name="contactInfo" defaultValue={supplier.contactInfo ?? ""} />
          <Field label="Payment terms" name="paymentTerms" defaultValue={supplier.paymentTerms ?? ""} />

          <div className="pt-2">
            <Button type="submit">Save changes</Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">Purchase orders</h2>
          <LinkButton href={`/purchase-orders/new?supplierId=${supplier.id}`} size="sm">
            New purchase order
          </LinkButton>
        </div>

        {supplier.purchaseOrders.length === 0 ? (
          <EmptyState message="No purchase orders yet for this supplier" />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>PO #</TableHeaderCell>
                <TableHeaderCell>Location</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Expected</TableHeaderCell>
                <TableHeaderCell>Created</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {supplier.purchaseOrders.map((po) => (
                <TableRow key={po.id}>
                  <TableCell>
                    <Link
                      href={`/purchase-orders/${po.id}`}
                      className="cursor-pointer font-medium text-text transition-colors duration-150 hover:text-primary hover:underline"
                    >
                      #{po.id}
                    </Link>
                  </TableCell>
                  <TableCell className="text-text-muted">{po.location.name}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[po.status] ?? "neutral"}>{po.status}</Badge>
                  </TableCell>
                  <TableCell className="text-text-muted">
                    {po.expectedDate ? new Date(po.expectedDate).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="text-text-muted">{new Date(po.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function Field({
  label,
  name,
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-xs font-medium text-text-muted">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      <Input id={name} name={name} required={required} defaultValue={defaultValue} />
    </div>
  );
}
