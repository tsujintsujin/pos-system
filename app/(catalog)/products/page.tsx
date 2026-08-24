import Link from "next/link";
import { prisma } from "@/lib/prisma";
import Banner from "@/app/components/Banner";
import Input from "@/app/components/ui/Input";
import Select from "@/app/components/ui/Select";
import Button, { LinkButton } from "@/app/components/ui/Button";
import PageHeader from "@/app/components/ui/PageHeader";
import StatCard from "@/app/components/ui/StatCard";
import Badge from "@/app/components/ui/Badge";
import EmptyState from "@/app/components/ui/EmptyState";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/app/components/ui/Table";

const DEFAULT_LOCATION_ID = 1;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoryId?: string; error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const categoryId = params.categoryId ? Number(params.categoryId) : null;

  const [categories, products] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({
      where: {
        ...(categoryId ? { categoryId } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { sku: { contains: q } },
                { barcode: { contains: q } },
              ],
            }
          : {}),
      },
      include: { category: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const productIds = products.map((p) => p.id);
  const stockRows = productIds.length
    ? await prisma.inventory.findMany({
        where: { locationId: DEFAULT_LOCATION_ID, variantId: null, productId: { in: productIds } },
        select: { productId: true, quantityOnHand: true },
      })
    : [];
  const stockByProduct = new Map(stockRows.map((r) => [r.productId, r.quantityOnHand.toNumber()]));

  const activeCount = products.filter((p) => p.isActive).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Products"
        subtitle={`${products.length} product${products.length === 1 ? "" : "s"}`}
        actions={<LinkButton href="/products/new">New product</LinkButton>}
      />

      <Banner error={params.error} success={params.success} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total SKUs" value={products.length} />
        <StatCard label="Active" value={activeCount} tone="success" />
        <StatCard label="Inactive" value={products.length - activeCount} tone="neutral" />
      </div>

      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="q" className="text-xs font-medium text-text-muted">
            Search (name / SKU / barcode)
          </label>
          <Input id="q" name="q" defaultValue={q} className="w-64" placeholder="Search products…" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="categoryId" className="text-xs font-medium text-text-muted">
            Category
          </label>
          <Select id="categoryId" name="categoryId" defaultValue={categoryId ?? ""} className="w-48">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
        {(q || categoryId) && (
          <LinkButton href="/products" variant="ghost">
            Clear
          </LinkButton>
        )}
      </form>

      {products.length === 0 ? (
        <EmptyState message="No products found" subMessage="Try a different search or filter." />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell className="w-12" />
              <TableHeaderCell>SKU</TableHeaderCell>
              <TableHeaderCell>Barcode</TableHeaderCell>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Category</TableHeaderCell>
              <TableHeaderCell className="text-right">Sell price</TableHeaderCell>
              <TableHeaderCell className="text-right">Stock (Main Store)</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
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
                      // arbitrary external URLs, no remotePatterns configured; see
                      // app/(catalog)/products/[id]/page.tsx
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.imageUrl}
                        alt=""
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
                  <TableCell>{p.name}</TableCell>
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
      )}
    </div>
  );
}
