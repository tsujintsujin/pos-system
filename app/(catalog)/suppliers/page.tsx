import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createSupplier } from "@/app/actions/suppliers";
import Banner from "@/app/components/Banner";
import Card from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Button, { LinkButton } from "@/app/components/ui/Button";
import PageHeader from "@/app/components/ui/PageHeader";
import EmptyState from "@/app/components/ui/EmptyState";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/app/components/ui/Table";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;

  const suppliers = await prisma.supplier.findMany({
    include: { _count: { select: { purchaseOrders: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Suppliers"
        subtitle={`${suppliers.length} supplier${suppliers.length === 1 ? "" : "s"}`}
        actions={
          <LinkButton href="/purchase-orders" variant="secondary" size="sm">
            Purchase orders
          </LinkButton>
        }
      />

      <Banner error={params.error} success={params.success} />

      {suppliers.length === 0 ? (
        <EmptyState message="No suppliers yet" subMessage="Add one using the form below." />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Contact info</TableHeaderCell>
              <TableHeaderCell>Payment terms</TableHeaderCell>
              <TableHeaderCell className="text-right">Purchase orders</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {suppliers.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <Link
                    href={`/suppliers/${s.id}`}
                    className="cursor-pointer font-medium text-text transition-colors duration-150 hover:text-primary hover:underline"
                  >
                    {s.name}
                  </Link>
                </TableCell>
                <TableCell className="text-text-muted">{s.contactInfo ?? "—"}</TableCell>
                <TableCell className="text-text-muted">{s.paymentTerms ?? "—"}</TableCell>
                <TableCell className="text-right">{s._count.purchaseOrders}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-text">Add supplier</h2>
        <form action={createSupplier} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="text-xs font-medium text-text-muted">
              Name <span className="text-danger">*</span>
            </label>
            <Input id="name" name="name" required className="w-56" placeholder="e.g. ABC Distribution Co." />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="contactInfo" className="text-xs font-medium text-text-muted">
              Contact info
            </label>
            <Input id="contactInfo" name="contactInfo" className="w-64" placeholder="e.g. phone / email" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="paymentTerms" className="text-xs font-medium text-text-muted">
              Payment terms
            </label>
            <Input id="paymentTerms" name="paymentTerms" className="w-48" placeholder="e.g. Net 30" />
          </div>
          <Button type="submit">Add supplier</Button>
        </form>
      </Card>
    </div>
  );
}
