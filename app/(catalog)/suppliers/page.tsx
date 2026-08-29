import Link from "next/link";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupplier } from "@/app/actions/suppliers";
import Banner from "@/app/components/Banner";
import Card from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Button, { LinkButton } from "@/app/components/ui/Button";
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

const SORT_COLUMNS = ["name", "contactInfo", "paymentTerms", "purchaseOrders"] as const;
type SortColumn = (typeof SORT_COLUMNS)[number];

function orderByFor(key: SortColumn, dir: "asc" | "desc"): Prisma.SupplierOrderByWithRelationInput {
  switch (key) {
    case "contactInfo":
      return { contactInfo: dir };
    case "paymentTerms":
      return { paymentTerms: dir };
    case "purchaseOrders":
      return { purchaseOrders: { _count: dir } };
    default:
      return { name: dir };
  }
}

export default async function SuppliersPage({
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

  const where: Prisma.SupplierWhereInput = q
    ? {
        OR: [
          { name: containsInsensitive(q) },
          { contactInfo: containsInsensitive(q) },
          { paymentTerms: containsInsensitive(q) },
        ],
      }
    : {};

  const total = await prisma.supplier.count({ where });
  const page = clampPage(parsePage(params.page), total, pageSize);
  const suppliers = await prisma.supplier.findMany({
    where,
    include: { _count: { select: { purchaseOrders: true } } },
    orderBy: orderByFor(sort.key, sort.dir),
    ...paginate(page, pageSize),
  });

  const sortProps = { activeColumn: params.sort ?? null, activeDirection: sort.dir };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Suppliers"
        subtitle={`${total} supplier${total === 1 ? "" : "s"}`}
        actions={
          <LinkButton href="/purchase-orders" variant="secondary" size="sm">
            Purchase orders
          </LinkButton>
        }
      />

      <Banner error={params.error} success={params.success} />

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

      <div className="flex flex-wrap items-end gap-3">
        <TableFilterInput
          name="q"
          label="Search (name / contact / terms)"
          placeholder="Search suppliers…"
          defaultValue={q}
          className="w-64"
        />
        {q && (
          <LinkButton href="/suppliers" variant="ghost" size="sm">
            Clear
          </LinkButton>
        )}
      </div>

      {total === 0 ? (
        <EmptyState
          message={q ? "No suppliers match this search" : "No suppliers yet"}
          subMessage={q ? "Try a different search." : "Add one using the form above."}
        />
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <SortableHeaderCell column="name" {...sortProps}>
                  Name
                </SortableHeaderCell>
                <SortableHeaderCell column="contactInfo" {...sortProps}>
                  Contact info
                </SortableHeaderCell>
                <SortableHeaderCell column="paymentTerms" {...sortProps}>
                  Payment terms
                </SortableHeaderCell>
                <SortableHeaderCell column="purchaseOrders" align="right" {...sortProps}>
                  Purchase orders
                </SortableHeaderCell>
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

          <TablePagination storageKey="suppliers" page={page} pageSize={pageSize} total={total} />
        </>
      )}
    </div>
  );
}
