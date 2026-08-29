import Link from "next/link";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import Banner from "@/app/components/Banner";
import { LinkButton } from "@/app/components/ui/Button";
import PageHeader from "@/app/components/ui/PageHeader";
import Badge, { type BadgeVariant } from "@/app/components/ui/Badge";
import EmptyState from "@/app/components/ui/EmptyState";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/app/components/ui/Table";
import TableFilterInput from "@/app/components/ui/TableFilterInput";
import TableDateFilter from "@/app/components/ui/TableDateFilter";
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
  COMPLETED: "success",
  VOIDED: "danger",
  PARKED: "neutral",
};

const SORT_COLUMNS = ["receipt", "date", "customer", "cashier", "lines", "total"] as const;
type SortColumn = (typeof SORT_COLUMNS)[number];

function orderByFor(key: SortColumn, dir: "asc" | "desc"): Prisma.SaleOrderByWithRelationInput {
  switch (key) {
    case "receipt":
      return { receiptNumber: dir };
    case "customer":
      return { customer: { name: dir } };
    case "cashier":
      return { cashier: { name: dir } };
    case "lines":
      return { lineItems: { _count: dir } };
    case "total":
      return { grandTotal: dir };
    default:
      // Sales are dated by completedAt, not createdAt — a sale can sit PARKED for a long
      // time before it completes (same reasoning as lib/reports.ts).
      return { completedAt: dir };
  }
}

/** YYYY-MM-DD only; anything else is ignored rather than throwing on an Invalid Date. */
function parseDateParam(value: string | undefined): string {
  if (!value || Number.isNaN(Date.parse(value))) return "";
  return value.slice(0, 10);
}

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{
    customer?: string;
    item?: string;
    from?: string;
    to?: string;
    sort?: string;
    dir?: string;
    page?: string;
    size?: string;
    error?: string;
    success?: string;
  }>;
}) {
  const params = await searchParams;
  const customer = (params.customer ?? "").trim();
  const item = (params.item ?? "").trim();
  const from = parseDateParam(params.from);
  const to = parseDateParam(params.to);

  const sort = parseSort(params.sort, params.dir, SORT_COLUMNS, { key: "date", dir: "desc" });
  const pageSize = parsePageSize(params.size);

  // Only sales that actually produced a receipt — a PARKED sale has no completed
  // transaction behind it yet.
  const where: Prisma.SaleWhereInput = {
    status: { in: ["COMPLETED", "VOIDED"] },
    ...(from || to
      ? {
          completedAt: {
            ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
          },
        }
      : {}),
    // Partial + case-insensitive on both text filters (see lib/list-params.ts).
    ...(customer ? { customer: { name: containsInsensitive(customer) } } : {}),
    ...(item
      ? {
          lineItems: {
            some: {
              OR: [
                { product: { name: containsInsensitive(item) } },
                { product: { sku: containsInsensitive(item) } },
                { variant: { name: containsInsensitive(item) } },
              ],
            },
          },
        }
      : {}),
  };

  const total = await prisma.sale.count({ where });
  const page = clampPage(parsePage(params.page), total, pageSize);
  const sales = await prisma.sale.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true } },
      cashier: { select: { name: true } },
      _count: { select: { lineItems: true } },
    },
    orderBy: orderByFor(sort.key, sort.dir),
    ...paginate(page, pageSize),
  });

  const sortProps = { activeColumn: params.sort ?? null, activeDirection: sort.dir };
  const filtered = Boolean(customer || item || from || to);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Receipts" subtitle={`${total} receipt${total === 1 ? "" : "s"}`} />

      <Banner error={params.error} success={params.success} />

      <div className="flex flex-wrap items-end gap-3">
        <TableFilterInput
          name="customer"
          label="Customer name"
          placeholder="Search customers…"
          defaultValue={customer}
          className="w-56"
        />
        <TableFilterInput
          name="item"
          label="Item / product"
          placeholder="Search items…"
          defaultValue={item}
          className="w-56"
        />
        <TableDateFilter fromValue={from} toValue={to} />
        {filtered && (
          <LinkButton href="/receipts" variant="ghost" size="sm">
            Clear
          </LinkButton>
        )}
      </div>

      {total === 0 ? (
        <EmptyState
          message={filtered ? "No receipts match these filters" : "No receipts yet"}
          subMessage={filtered ? "Try a different search or date range." : "Completed sales will appear here."}
        />
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <SortableHeaderCell column="receipt" {...sortProps}>
                  Receipt #
                </SortableHeaderCell>
                <SortableHeaderCell column="date" {...sortProps}>
                  Date
                </SortableHeaderCell>
                <SortableHeaderCell column="customer" {...sortProps}>
                  Customer
                </SortableHeaderCell>
                <SortableHeaderCell column="cashier" {...sortProps}>
                  Cashier
                </SortableHeaderCell>
                <SortableHeaderCell column="lines" align="right" {...sortProps}>
                  Items
                </SortableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <SortableHeaderCell column="total" align="right" {...sortProps}>
                  Total
                </SortableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sales.map((s) => (
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
                  <TableCell className="text-text-muted">
                    {s.customer ? (
                      <Link
                        href={`/customers/${s.customer.id}`}
                        className="cursor-pointer transition-colors duration-150 hover:text-primary hover:underline"
                      >
                        {s.customer.name}
                      </Link>
                    ) : (
                      "Walk-in"
                    )}
                  </TableCell>
                  <TableCell className="text-text-muted">{s.cashier.name}</TableCell>
                  <TableCell className="text-right">{s._count.lineItems}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[s.status] ?? "neutral"}>{s.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">₱{s.grandTotal.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <TablePagination storageKey="receipts" page={page} pageSize={pageSize} total={total} />
        </>
      )}
    </div>
  );
}
