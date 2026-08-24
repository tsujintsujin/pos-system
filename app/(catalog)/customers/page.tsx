import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createCustomer } from "@/app/actions/customers";
import Banner from "@/app/components/Banner";
import Card from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Select from "@/app/components/ui/Select";
import Button, { LinkButton } from "@/app/components/ui/Button";
import PageHeader from "@/app/components/ui/PageHeader";
import EmptyState from "@/app/components/ui/EmptyState";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/app/components/ui/Table";
import { SearchIcon } from "@/app/components/ui/icons";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();

  const [customerGroups, customers] = await Promise.all([
    prisma.customerGroup.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.customer.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q } },
              { phone: { contains: q } },
              { email: { contains: q } },
            ],
          }
        : {},
      include: { customerGroup: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} customer${customers.length === 1 ? "" : "s"}`}
        actions={
          <LinkButton href="/customers/groups" variant="secondary" size="sm">
            Manage customer groups
          </LinkButton>
        }
      />

      <Banner error={params.error} success={params.success} />

      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="q" className="text-xs font-medium text-text-muted">
            Search (name / phone / email)
          </label>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input id="q" name="q" defaultValue={q} className="w-64 pl-9" placeholder="Search customers…" />
          </div>
        </div>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
        {q && (
          <LinkButton href="/customers" variant="ghost" size="sm">
            Clear
          </LinkButton>
        )}
      </form>

      {customers.length === 0 ? (
        <EmptyState message="No customers found" subMessage="Try a different search, or add one below." />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Phone</TableHeaderCell>
              <TableHeaderCell>Email</TableHeaderCell>
              <TableHeaderCell>Group</TableHeaderCell>
              <TableHeaderCell className="text-right">Loyalty pts</TableHeaderCell>
              <TableHeaderCell className="text-right">Store credit</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {customers.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link
                    href={`/customers/${c.id}`}
                    className="cursor-pointer font-medium text-text transition-colors duration-150 hover:text-primary hover:underline"
                  >
                    {c.name}
                  </Link>
                </TableCell>
                <TableCell className="text-text-muted">{c.phone ?? "—"}</TableCell>
                <TableCell className="text-text-muted">{c.email ?? "—"}</TableCell>
                <TableCell className="text-text-muted">{c.customerGroup?.name ?? "—"}</TableCell>
                <TableCell className="text-right">{c.loyaltyPointsBalance}</TableCell>
                <TableCell className="text-right">₱{c.storeCreditBalance.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-text">Quick-add customer</h2>
        <form action={createCustomer} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="text-xs font-medium text-text-muted">
              Name <span className="text-danger">*</span>
            </label>
            <Input id="name" name="name" required className="w-48" placeholder="e.g. Maria Santos" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="phone" className="text-xs font-medium text-text-muted">
              Phone
            </label>
            <Input id="phone" name="phone" className="w-40" placeholder="e.g. 09171234567" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-xs font-medium text-text-muted">
              Email
            </label>
            <Input id="email" name="email" type="email" className="w-56" placeholder="e.g. maria@example.com" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="customerGroupId" className="text-xs font-medium text-text-muted">
              Group
            </label>
            <Select id="customerGroupId" name="customerGroupId" className="w-40" defaultValue="">
              <option value="">None</option>
              {customerGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit">Add customer</Button>
        </form>
      </Card>
    </div>
  );
}
