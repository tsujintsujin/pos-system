import Link from "next/link";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import AddCustomerModal from "@/app/components/AddCustomerModal";
import Banner from "@/app/components/Banner";
import { LinkButton } from "@/app/components/ui/Button";
import PageHeader from "@/app/components/ui/PageHeader";
import EmptyState from "@/app/components/ui/EmptyState";
import { Table, TableHead, TableBody, TableRow, TableCell } from "@/app/components/ui/Table";
import TableFilterInput from "@/app/components/ui/TableFilterInput";
import SortableHeaderCell from "@/app/components/ui/SortableHeaderCell";
import TablePagination from "@/app/components/ui/TablePagination";
import {
  containsInsensitive,
  clampPage,
  paginate,
  parsePage,
  parsePageSize,
  parseSort,
} from "@/lib/list-params";

const SORT_COLUMNS = ["name", "phone", "email", "group", "loyalty", "credit"] as const;
type SortColumn = (typeof SORT_COLUMNS)[number];

function orderByFor(key: SortColumn, dir: "asc" | "desc"): Prisma.CustomerOrderByWithRelationInput {
  switch (key) {
    case "phone":
      return { phone: dir };
    case "email":
      return { email: dir };
    case "group":
      return { customerGroup: { name: dir } };
    case "loyalty":
      return { loyaltyPointsBalance: dir };
    case "credit":
      return { storeCreditBalance: dir };
    default:
      return { name: dir };
  }
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    sort?: string;
    dir?: string;
    page?: string;
    size?: string;
    error?: string;
    success?: string;
  }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();

  const sort = parseSort(params.sort, params.dir, SORT_COLUMNS, { key: "name", dir: "asc" });
  const pageSize = parsePageSize(params.size);

  // Partial + case-insensitive: typing "an" matches both "Banana Republic" and "Andrea".
  const where: Prisma.CustomerWhereInput = q
    ? {
        OR: [
          { name: containsInsensitive(q) },
          { phone: containsInsensitive(q) },
          { email: containsInsensitive(q) },
        ],
      }
    : {};

  const [customerGroups, total] = await Promise.all([
    prisma.customerGroup.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.customer.count({ where }),
  ]);

  const page = clampPage(parsePage(params.page), total, pageSize);
  const customers = await prisma.customer.findMany({
    where,
    include: { customerGroup: { select: { name: true } } },
    orderBy: orderByFor(sort.key, sort.dir),
    ...paginate(page, pageSize),
  });

  const sortProps = { activeColumn: params.sort ?? null, activeDirection: sort.dir };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Customers"
        subtitle={`${total} customer${total === 1 ? "" : "s"}`}
        actions={
          <>
            <LinkButton href="/customers/groups" variant="secondary" size="sm">
              Manage customer groups
            </LinkButton>
            <AddCustomerModal customerGroups={customerGroups} />
          </>
        }
      />

      <Banner error={params.error} success={params.success} />

      <div className="flex flex-wrap items-end gap-3">
        <TableFilterInput
          name="q"
          label="Search (name / phone / email)"
          placeholder="Search customers…"
          defaultValue={q}
          className="w-64"
        />
        {q && (
          <LinkButton href="/customers" variant="ghost" size="sm">
            Clear
          </LinkButton>
        )}
      </div>

      {total === 0 ? (
        <EmptyState message="No customers found" subMessage="Try a different search, or add one with the button above." />
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <SortableHeaderCell column="name" {...sortProps}>
                  Name
                </SortableHeaderCell>
                <SortableHeaderCell column="phone" {...sortProps}>
                  Phone
                </SortableHeaderCell>
                <SortableHeaderCell column="email" {...sortProps}>
                  Email
                </SortableHeaderCell>
                <SortableHeaderCell column="group" {...sortProps}>
                  Group
                </SortableHeaderCell>
                <SortableHeaderCell column="loyalty" align="right" {...sortProps}>
                  Loyalty pts
                </SortableHeaderCell>
                <SortableHeaderCell column="credit" align="right" {...sortProps}>
                  Store credit
                </SortableHeaderCell>
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

          <TablePagination storageKey="customers" page={page} pageSize={pageSize} total={total} />
        </>
      )}

    </div>
  );
}
