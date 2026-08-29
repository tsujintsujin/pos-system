import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateCustomer } from "@/app/actions/customers";
import Banner from "@/app/components/Banner";
import Card from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Select from "@/app/components/ui/Select";
import Button, { LinkButton } from "@/app/components/ui/Button";
import PageHeader from "@/app/components/ui/PageHeader";
import StatCard from "@/app/components/ui/StatCard";
import EmptyState from "@/app/components/ui/EmptyState";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/app/components/ui/Table";

export default async function CustomerProfilePage({
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

  const [customer, customerGroups] = await Promise.all([
    prisma.customer.findUnique({
      where: { id },
      include: {
        sales: {
          where: { status: "COMPLETED" },
          orderBy: { completedAt: "desc" },
          take: 10,
          select: {
            id: true,
            receiptNumber: true,
            grandTotal: true,
            completedAt: true,
            _count: { select: { lineItems: true } },
          },
        },
      },
    }),
    prisma.customerGroup.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!customer) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Customer"
        subtitle={customer.name}
        backHref="/customers"
        backLabel="Back to customers"
      />

      <Banner error={sp.error} success={sp.success} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Loyalty points" value={customer.loyaltyPointsBalance} />
        <StatCard label="Store credit" value={`₱${customer.storeCreditBalance.toFixed(2)}`} />
      </div>
      <p className="-mt-3 text-xs text-text-muted">
        Loyalty points and store credit are read-only here — they&apos;re written by other flows
        (loyalty accrual, and returns issued as store credit).
      </p>

      <Card>
        <form action={updateCustomer.bind(null, customer.id)} className="flex max-w-xl flex-col gap-4">
          <Field label="Name" name="name" required defaultValue={customer.name} />
          <Field label="Phone" name="phone" defaultValue={customer.phone ?? ""} />
          <Field label="Email" name="email" type="email" defaultValue={customer.email ?? ""} />

          <div className="flex flex-col gap-1">
            <label htmlFor="customerGroupId" className="text-xs font-medium text-text-muted">
              Customer group
            </label>
            <Select id="customerGroupId" name="customerGroupId" defaultValue={customer.customerGroupId ?? ""}>
              <option value="">None</option>
              {customerGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="pt-2">
            <Button type="submit">Save changes</Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-text">Recent completed sales</h2>
          <LinkButton href={`/receipts?customer=${encodeURIComponent(customer.name)}`} variant="secondary" size="sm">
            All receipts
          </LinkButton>
        </div>
        {customer.sales.length === 0 ? (
          <EmptyState message="No completed sales for this customer yet" />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Receipt #</TableHeaderCell>
                <TableHeaderCell>Date</TableHeaderCell>
                <TableHeaderCell className="text-right">Items</TableHeaderCell>
                <TableHeaderCell className="text-right">Total</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {customer.sales.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link
                      href={`/receipts/${s.id}`}
                      className="cursor-pointer font-medium text-text transition-colors duration-150 hover:text-primary hover:underline"
                    >
                      {s.receiptNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-text-muted">
                    {s.completedAt ? new Date(s.completedAt).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell className="text-right">{s._count.lineItems}</TableCell>
                  <TableCell className="text-right">₱{s.grandTotal.toFixed(2)}</TableCell>
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
  type = "text",
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-xs font-medium text-text-muted">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      <Input id={name} name={name} type={type} required={required} defaultValue={defaultValue} />
    </div>
  );
}
