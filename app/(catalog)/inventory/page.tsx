import Link from "next/link";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import Banner from "@/app/components/Banner";
import AdjustStockForm from "@/app/components/AdjustStockForm";
import PageHeader from "@/app/components/ui/PageHeader";
import StatCard from "@/app/components/ui/StatCard";
import Badge from "@/app/components/ui/Badge";
import EmptyState from "@/app/components/ui/EmptyState";
import { LinkButton } from "@/app/components/ui/Button";
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

const DEFAULT_LOCATION_ID = 1;

const SORT_COLUMNS = ["product", "category", "reorderAt", "onHand"] as const;
type SortColumn = (typeof SORT_COLUMNS)[number];

const STATUS_OPTIONS = [
  { value: "low", label: "Low stock" },
  { value: "negative", label: "Negative" },
  { value: "ok", label: "OK" },
];

function orderByFor(key: SortColumn, dir: "asc" | "desc"): Prisma.InventoryOrderByWithRelationInput {
  switch (key) {
    case "category":
      return { product: { category: { name: dir } } };
    case "reorderAt":
      return { product: { reorderThreshold: dir } };
    case "onHand":
      return { quantityOnHand: dir };
    default:
      return { product: { name: dir } };
  }
}

/**
 * The status filter compares two columns on two different tables
 * (inventory.quantityOnHand vs products.reorderThreshold), which Prisma's `where` can't
 * express — field references only work within one model. So the status is resolved to a
 * set of inventory ids in SQL and folded back into the Prisma query as `id: { in: … }`,
 * keeping the count, ordering and pagination in the database.
 */
async function inventoryIdsForStatus(status: string): Promise<number[]> {
  const rows = await (status === "negative"
    ? prisma.$queryRaw<{ id: number }[]>`
        SELECT i.id FROM inventory i
        WHERE i."locationId" = ${DEFAULT_LOCATION_ID} AND i."quantityOnHand" < 0`
    : status === "ok"
      ? prisma.$queryRaw<{ id: number }[]>`
          SELECT i.id FROM inventory i JOIN products p ON p.id = i."productId"
          WHERE i."locationId" = ${DEFAULT_LOCATION_ID}
            AND i."quantityOnHand" > p."reorderThreshold"`
      : prisma.$queryRaw<{ id: number }[]>`
          SELECT i.id FROM inventory i JOIN products p ON p.id = i."productId"
          WHERE i."locationId" = ${DEFAULT_LOCATION_ID}
            AND i."quantityOnHand" >= 0 AND i."quantityOnHand" <= p."reorderThreshold"`);
  return rows.map((r) => r.id);
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    sku?: string;
    categoryId?: string;
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
  const sku = (params.sku ?? "").trim();
  const categoryIdParam = params.categoryId ?? "";
  const categoryId = categoryIdParam ? Number(categoryIdParam) : null;
  const status = STATUS_OPTIONS.some((s) => s.value === params.status) ? params.status! : "";

  const sort = parseSort(params.sort, params.dir, SORT_COLUMNS, { key: "product", dir: "asc" });
  const pageSize = parsePageSize(params.size);

  const statusIds = status ? await inventoryIdsForStatus(status) : null;

  // All filters are partial + case-insensitive. The SKU filter matches either the
  // product's own SKU (base-unit rows) or the variant's (variant rows).
  const where: Prisma.InventoryWhereInput = {
    locationId: DEFAULT_LOCATION_ID,
    ...(statusIds ? { id: { in: statusIds } } : {}),
    ...(categoryId ? { product: { categoryId } } : {}),
    ...(q ? { product: { name: containsInsensitive(q) } } : {}),
    ...(sku
      ? {
          OR: [
            { product: { sku: containsInsensitive(sku) } },
            { variant: { sku: containsInsensitive(sku) } },
          ],
        }
      : {}),
  };

  const [categories, location, total, statusCounts] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.location.findUnique({ where: { id: DEFAULT_LOCATION_ID }, select: { name: true } }),
    prisma.inventory.count({ where }),
    // Stat cards deliberately describe the whole location, not the current filter —
    // same as before this page was paginated.
    prisma.$queryRaw<{ total: number; low: number; negative: number }[]>`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE i."quantityOnHand" >= 0 AND i."quantityOnHand" <= p."reorderThreshold")::int AS low,
        count(*) FILTER (WHERE i."quantityOnHand" < 0)::int AS negative
      FROM inventory i JOIN products p ON p.id = i."productId"
      WHERE i."locationId" = ${DEFAULT_LOCATION_ID}`,
  ]);

  const counts = statusCounts[0] ?? { total: 0, low: 0, negative: 0 };
  const okCount = counts.total - counts.low - counts.negative;

  const page = clampPage(parsePage(params.page), total, pageSize);
  const rows = await prisma.inventory.findMany({
    where,
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          reorderThreshold: true,
          category: { select: { name: true } },
        },
      },
      variant: { select: { id: true, name: true, sku: true } },
    },
    orderBy: orderByFor(sort.key, sort.dir),
    ...paginate(page, pageSize),
  });

  const sortProps = { activeColumn: params.sort ?? null, activeDirection: sort.dir };
  const filtered = Boolean(q || sku || categoryId || status);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Inventory" subtitle={location?.name ?? "Main Store"} />

      <Banner error={params.error} success={params.success} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Tracked SKUs" value={counts.total} />
        <StatCard label="OK" value={okCount} tone="success" />
        <StatCard
          label="Low stock"
          value={counts.low}
          subLabel="at/below reorder threshold"
          tone={counts.low > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Negative stock"
          value={counts.negative}
          subLabel="oversold — needs correction"
          tone={counts.negative > 0 ? "danger" : "neutral"}
        />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <TableFilterInput
          name="q"
          label="Product name"
          placeholder="Search products…"
          defaultValue={q}
          className="w-56"
        />
        <TableFilterInput
          name="sku"
          label="SKU"
          placeholder="Search SKUs…"
          defaultValue={sku}
          className="w-44"
          showIcon={false}
        />
        <TableSelectFilter
          name="categoryId"
          label="Category"
          value={categoryIdParam}
          allLabel="All categories"
          options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
          className="w-44"
        />
        <TableSelectFilter
          name="status"
          label="Status"
          value={status}
          allLabel="All statuses"
          options={STATUS_OPTIONS}
          className="w-40"
        />
        {filtered && (
          <LinkButton href="/inventory" variant="ghost">
            Clear
          </LinkButton>
        )}
      </div>

      {total === 0 ? (
        <EmptyState
          message={filtered ? "No stock rows match these filters" : "No stock-tracked products yet"}
          subMessage={filtered ? "Try a different search or filter." : undefined}
        />
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>SKU</TableHeaderCell>
                <SortableHeaderCell column="product" {...sortProps}>
                  Product
                </SortableHeaderCell>
                <SortableHeaderCell column="category" {...sortProps}>
                  Category
                </SortableHeaderCell>
                <SortableHeaderCell column="reorderAt" align="right" {...sortProps}>
                  Reorder at
                </SortableHeaderCell>
                <SortableHeaderCell column="onHand" align="right" {...sortProps}>
                  On hand
                </SortableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell className="text-right">Adjust</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => {
                const qty = r.quantityOnHand.toNumber();
                const negative = qty < 0;
                const low = !negative && qty <= r.product.reorderThreshold;
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link
                        href={`/products/${r.product.id}`}
                        className="cursor-pointer font-medium text-text transition-colors duration-150 hover:text-primary hover:underline"
                      >
                        {r.variant?.sku ?? r.product.sku}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/products/${r.product.id}`}
                        className="cursor-pointer font-medium text-text transition-colors duration-150 hover:text-primary hover:underline"
                      >
                        {r.product.name}
                      </Link>
                      {r.variant && <span className="text-text-muted"> — {r.variant.name}</span>}
                    </TableCell>
                    <TableCell className="text-text-muted">{r.product.category?.name ?? "—"}</TableCell>
                    <TableCell className="text-right text-text-muted">{r.product.reorderThreshold}</TableCell>
                    <TableCell className="text-right font-medium">
                      <span className={negative ? "text-danger" : low ? "text-warning" : "text-text"}>
                        {qty}
                      </span>
                    </TableCell>
                    <TableCell>
                      {negative ? (
                        <Badge variant="danger">Negative</Badge>
                      ) : low ? (
                        <Badge variant="warning">Low stock</Badge>
                      ) : (
                        <Badge variant="success">OK</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <AdjustStockForm
                        locationId={DEFAULT_LOCATION_ID}
                        productId={r.product.id}
                        variantId={r.variantId}
                        label={`Adjust ${r.product.name}${r.variant ? ` — ${r.variant.name}` : ""}`}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <TablePagination storageKey="inventory" page={page} pageSize={pageSize} total={total} />
        </>
      )}
    </div>
  );
}
