import Link from "next/link";
import type { Prisma } from "@/app/generated/prisma/client";
import type { PurchaseOrderStatus } from "@/app/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import Banner from "@/app/components/Banner";
import { LinkButton } from "@/app/components/ui/Button";
import PageHeader from "@/app/components/ui/PageHeader";
import Badge, { type BadgeVariant } from "@/app/components/ui/Badge";
import EmptyState from "@/app/components/ui/EmptyState";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/app/components/ui/Table";
import TableFilterInput from "@/app/components/ui/TableFilterInput";
import TableSelectFilter from "@/app/components/ui/TableSelectFilter";
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

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  DRAFT: "neutral",
  ORDERED: "info",
  PARTIAL: "warning",
  RECEIVED: "success",
  CANCELLED: "danger",
};

const STATUS_OPTIONS = Object.keys(STATUS_VARIANTS).map((s) => ({ value: s, label: s }));

const SORT_COLUMNS = ["po", "supplier", "status", "lines", "expected", "created"] as const;
type SortColumn = (typeof SORT_COLUMNS)[number];

function orderByFor(key: SortColumn, dir: "asc" | "desc"): Prisma.PurchaseOrderOrderByWithRelationInput {
  switch (key) {
    case "supplier":
      return { supplier: { name: dir } };
    case "status":
      return { status: dir };
    case "lines":
      return { lineItems: { _count: dir } };
    case "expected":
      return { expectedDate: dir };
    case "created":
      return { createdAt: dir };
    default:
      // "PO #" is the autoincrement id.
      return { id: dir };
  }
}

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
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
  const status = STATUS_OPTIONS.some((s) => s.value === params.status) ? params.status! : "";

  const sort = parseSort(params.sort, params.dir, SORT_COLUMNS, { key: "created", dir: "desc" });
  const pageSize = parsePageSize(params.size);

  const where: Prisma.PurchaseOrderWhereInput = {
    ...(status ? { status: status as PurchaseOrderStatus } : {}),
    ...(q ? { supplier: { name: containsInsensitive(q) } } : {}),
  };

  const total = await prisma.purchaseOrder.count({ where });
  const page = clampPage(parsePage(params.page), total, pageSize);
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where,
    include: {
      supplier: { select: { name: true } },
      location: { select: { name: true } },
      _count: { select: { lineItems: true } },
    },
    orderBy: orderByFor(sort.key, sort.dir),
    ...paginate(page, pageSize),
  });

  const sortProps = { activeColumn: params.sort ?? null, activeDirection: sort.dir };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Purchase orders"
        subtitle={`${total} order${total === 1 ? "" : "s"}`}
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

      <div className="flex flex-wrap items-end gap-3">
        <TableFilterInput
          name="q"
          label="Supplier"
          placeholder="Search suppliers…"
          defaultValue={q}
          className="w-56"
        />
        <TableSelectFilter
          name="status"
          label="Status"
          value={status}
          allLabel="All statuses"
          options={STATUS_OPTIONS}
          className="w-44"
        />
        {(q || status) && (
          <LinkButton href="/purchase-orders" variant="ghost" size="sm">
            Clear
          </LinkButton>
        )}
      </div>

      {total === 0 ? (
        <EmptyState
          message={q || status ? "No purchase orders match these filters" : "No purchase orders yet"}
          subMessage={q || status ? "Try a different search or filter." : "Create one to get started."}
        />
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <SortableHeaderCell column="po" {...sortProps}>
                  PO #
                </SortableHeaderCell>
                <SortableHeaderCell column="supplier" {...sortProps}>
                  Supplier
                </SortableHeaderCell>
                <TableHeaderCell>Location</TableHeaderCell>
                <SortableHeaderCell column="status" {...sortProps}>
                  Status
                </SortableHeaderCell>
                <SortableHeaderCell column="lines" align="right" {...sortProps}>
                  Lines
                </SortableHeaderCell>
                <SortableHeaderCell column="expected" {...sortProps}>
                  Expected
                </SortableHeaderCell>
                <SortableHeaderCell column="created" {...sortProps}>
                  Created
                </SortableHeaderCell>
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
                  <TableCell className="text-text-muted">
                    {new Date(po.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <TablePagination
            storageKey="purchase-orders"
            page={page}
            pageSize={pageSize}
            total={total}
          />
        </>
      )}
    </div>
  );
}
