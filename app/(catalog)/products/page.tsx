import Link from "next/link";
import Image from "next/image";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import Banner from "@/app/components/Banner";
import { LinkButton } from "@/app/components/ui/Button";
import PageHeader from "@/app/components/ui/PageHeader";
import StatCard from "@/app/components/ui/StatCard";
import Badge from "@/app/components/ui/Badge";
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

const DEFAULT_LOCATION_ID = 1;

const SORT_COLUMNS = ["sku", "barcode", "name", "category", "sellPrice", "status"] as const;
type SortColumn = (typeof SORT_COLUMNS)[number];

function orderByFor(key: SortColumn, dir: "asc" | "desc"): Prisma.ProductOrderByWithRelationInput {
  switch (key) {
    case "sku":
      return { sku: dir };
    case "barcode":
      return { barcode: dir };
    case "category":
      return { category: { name: dir } };
    case "sellPrice":
      return { sellPrice: dir };
    case "status":
      return { isActive: dir };
    default:
      return { name: dir };
  }
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    categoryId?: string;
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
  const categoryIdParam = params.categoryId ?? "";
  const categoryId = categoryIdParam ? Number(categoryIdParam) : null;

  const sort = parseSort(params.sort, params.dir, SORT_COLUMNS, { key: "name", dir: "asc" });
  const pageSize = parsePageSize(params.size);

  // Filters are partial + case-insensitive (see lib/list-params.ts) — typing "an" must
  // match "Banana" as well as "Anchor". A bare `contains` is case-sensitive on Postgres.
  const where: Prisma.ProductWhereInput = {
    ...(categoryId ? { categoryId } : {}),
    ...(q
      ? {
          OR: [
            { name: containsInsensitive(q) },
            { sku: containsInsensitive(q) },
            { barcode: containsInsensitive(q) },
          ],
        }
      : {}),
  };

  const [categories, total, activeCount] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.product.count({ where }),
    prisma.product.count({ where: { ...where, isActive: true } }),
  ]);

  const page = clampPage(parsePage(params.page), total, pageSize);
  const products = await prisma.product.findMany({
    where,
    include: { category: { select: { name: true } } },
    orderBy: orderByFor(sort.key, sort.dir),
    ...paginate(page, pageSize),
  });

  const productIds = products.map((p) => p.id);
  const stockRows = productIds.length
    ? await prisma.inventory.findMany({
        where: { locationId: DEFAULT_LOCATION_ID, variantId: null, productId: { in: productIds } },
        select: { productId: true, quantityOnHand: true },
      })
    : [];
  const stockByProduct = new Map(stockRows.map((r) => [r.productId, r.quantityOnHand.toNumber()]));

  const sortProps = { activeColumn: params.sort ?? null, activeDirection: sort.dir };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Products"
        subtitle={`${total} product${total === 1 ? "" : "s"}`}
        actions={<LinkButton href="/products/new">New product</LinkButton>}
      />

      <Banner error={params.error} success={params.success} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total SKUs" value={total} />
        <StatCard label="Active" value={activeCount} tone="success" />
        <StatCard label="Inactive" value={total - activeCount} tone="neutral" />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <TableFilterInput
          name="q"
          label="Search (name / SKU / barcode)"
          placeholder="Search products…"
          defaultValue={q}
          className="w-64"
        />
        <TableSelectFilter
          name="categoryId"
          label="Category"
          value={categoryIdParam}
          allLabel="All categories"
          options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
          className="w-48"
        />
        {(q || categoryId) && (
          <LinkButton href="/products" variant="ghost">
            Clear
          </LinkButton>
        )}
      </div>

      {total === 0 ? (
        <EmptyState message="No products found" subMessage="Try a different search or filter." />
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell className="w-12" />
                <SortableHeaderCell column="sku" {...sortProps}>
                  SKU
                </SortableHeaderCell>
                <SortableHeaderCell column="barcode" {...sortProps}>
                  Barcode
                </SortableHeaderCell>
                <SortableHeaderCell column="name" {...sortProps}>
                  Name
                </SortableHeaderCell>
                <SortableHeaderCell column="category" {...sortProps}>
                  Category
                </SortableHeaderCell>
                <SortableHeaderCell column="sellPrice" align="right" {...sortProps}>
                  Sell price
                </SortableHeaderCell>
                <TableHeaderCell className="text-right">Stock (Main Store)</TableHeaderCell>
                <SortableHeaderCell column="status" {...sortProps}>
                  Status
                </SortableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {products.map((p) => {
                const stock = stockByProduct.get(p.id) ?? 0;
                const low = p.trackStock && stock <= p.reorderThreshold;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      {p.imageUrl ? (
                        <Image
                          src={p.imageUrl}
                          alt=""
                          width={32}
                          height={32}
                          loading="lazy"
                          className="h-8 w-8 rounded border border-border object-cover"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded border border-dashed border-border" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/products/${p.id}`}
                        className="cursor-pointer font-medium text-text transition-colors duration-150 hover:text-primary hover:underline"
                      >
                        {p.sku}
                      </Link>
                    </TableCell>
                    <TableCell className="text-text-muted">{p.barcode ?? "—"}</TableCell>
                    <TableCell>
                      <Link
                        href={`/products/${p.id}`}
                        className="cursor-pointer font-medium text-text transition-colors duration-150 hover:text-primary hover:underline"
                      >
                        {p.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-text-muted">{p.category?.name ?? "—"}</TableCell>
                    <TableCell className="text-right">₱{p.sellPrice.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      {p.trackStock ? (
                        <span
                          className={
                            stock < 0
                              ? "font-medium text-danger"
                              : low
                                ? "font-medium text-warning"
                                : "text-text"
                          }
                        >
                          {stock}
                        </span>
                      ) : (
                        <span className="text-text-muted">not tracked</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.isActive ? "success" : "neutral"}>
                        {p.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <TablePagination storageKey="products" page={page} pageSize={pageSize} total={total} />
        </>
      )}
    </div>
  );
}
