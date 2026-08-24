import { prisma } from "@/lib/prisma";
import Banner from "@/app/components/Banner";
import AdjustStockForm from "@/app/components/AdjustStockForm";
import PageHeader from "@/app/components/ui/PageHeader";
import StatCard from "@/app/components/ui/StatCard";
import Badge from "@/app/components/ui/Badge";
import EmptyState from "@/app/components/ui/EmptyState";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/app/components/ui/Table";

const DEFAULT_LOCATION_ID = 1;

type Row = {
  productId: number;
  variantId: number | null;
  sku: string;
  barcode: string | null;
  productName: string;
  variantName: string | null;
  categoryName: string | null;
  reorderThreshold: number;
  quantityOnHand: number;
};

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;

  const [products, inventoryRows, location] = await Promise.all([
    prisma.product.findMany({
      where: { trackStock: true },
      include: {
        category: { select: { name: true } },
        variants: { orderBy: { name: "asc" } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.inventory.findMany({
      where: { locationId: DEFAULT_LOCATION_ID },
      select: { productId: true, variantId: true, quantityOnHand: true },
    }),
    prisma.location.findUnique({ where: { id: DEFAULT_LOCATION_ID }, select: { name: true } }),
  ]);

  const stockMap = new Map(
    inventoryRows.map((r) => [`${r.productId}_${r.variantId ?? "base"}`, r.quantityOnHand.toNumber()]),
  );

  const rows: Row[] = [];
  for (const p of products) {
    rows.push({
      productId: p.id,
      variantId: null,
      sku: p.sku,
      barcode: p.barcode,
      productName: p.name,
      variantName: null,
      categoryName: p.category?.name ?? null,
      reorderThreshold: p.reorderThreshold,
      quantityOnHand: stockMap.get(`${p.id}_base`) ?? 0,
    });
    for (const v of p.variants) {
      rows.push({
        productId: p.id,
        variantId: v.id,
        sku: v.sku,
        barcode: v.barcode,
        productName: p.name,
        variantName: v.name,
        categoryName: p.category?.name ?? null,
        reorderThreshold: p.reorderThreshold,
        quantityOnHand: stockMap.get(`${p.id}_${v.id}`) ?? 0,
      });
    }
  }

  const lowCount = rows.filter((r) => r.quantityOnHand >= 0 && r.quantityOnHand <= r.reorderThreshold).length;
  const negativeCount = rows.filter((r) => r.quantityOnHand < 0).length;
  const okCount = rows.length - lowCount - negativeCount;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Inventory" subtitle={location?.name ?? "Main Store"} />

      <Banner error={params.error} success={params.success} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Tracked SKUs" value={rows.length} />
        <StatCard label="OK" value={okCount} tone="success" />
        <StatCard
          label="Low stock"
          value={lowCount}
          subLabel="at/below reorder threshold"
          tone={lowCount > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Negative stock"
          value={negativeCount}
          subLabel="oversold — needs correction"
          tone={negativeCount > 0 ? "danger" : "neutral"}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState message="No stock-tracked products yet" />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>SKU</TableHeaderCell>
              <TableHeaderCell>Product</TableHeaderCell>
              <TableHeaderCell>Category</TableHeaderCell>
              <TableHeaderCell className="text-right">Reorder at</TableHeaderCell>
              <TableHeaderCell className="text-right">On hand</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell className="text-right">Adjust</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => {
              const negative = r.quantityOnHand < 0;
              const low = !negative && r.quantityOnHand <= r.reorderThreshold;
              return (
                <TableRow key={`${r.productId}_${r.variantId ?? "base"}`}>
                  <TableCell>
                    <a
                      href={`/products/${r.productId}`}
                      className="cursor-pointer font-medium text-text transition-colors duration-150 hover:text-primary hover:underline"
                    >
                      {r.sku}
                    </a>
                  </TableCell>
                  <TableCell>
                    {r.productName}
                    {r.variantName && <span className="text-text-muted"> — {r.variantName}</span>}
                  </TableCell>
                  <TableCell className="text-text-muted">{r.categoryName ?? "—"}</TableCell>
                  <TableCell className="text-right text-text-muted">{r.reorderThreshold}</TableCell>
                  <TableCell className="text-right font-medium">
                    <span className={negative ? "text-danger" : low ? "text-warning" : "text-text"}>
                      {r.quantityOnHand}
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
                      productId={r.productId}
                      variantId={r.variantId}
                      label={`Adjust ${r.productName}${r.variantName ? ` — ${r.variantName}` : ""}`}
                    />
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
