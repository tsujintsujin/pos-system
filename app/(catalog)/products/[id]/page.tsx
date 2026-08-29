import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  updateProduct,
  addVariant,
  deleteVariant,
  addComponent,
  removeComponent,
} from "@/app/actions/products";
import Banner from "@/app/components/Banner";
import Card from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Select from "@/app/components/ui/Select";
import Textarea from "@/app/components/ui/Textarea";
import Button, { LinkButton } from "@/app/components/ui/Button";
import PageHeader from "@/app/components/ui/PageHeader";
import ProductLink from "@/app/components/ui/ProductLink";
import ProductPerformanceCard from "@/app/components/ProductPerformanceCard";
import ProductImageField from "@/app/components/ProductImageField";
import { parseProductSeriesRange } from "@/lib/reports";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/app/components/ui/Table";

const DEFAULT_LOCATION_ID = 1;

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string; range?: string }>;
}) {
  const { id: idParam } = await params;
  const sp = await searchParams;
  const id = Number(idParam);
  if (Number.isNaN(id)) notFound();

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      variants: { orderBy: { name: "asc" } },
      components: { include: { component: true } }, // this product's own bundle components
    },
  });
  if (!product) notFound();

  const [categories, taxClasses, candidateComponents, inventoryRows] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.taxClass.findMany({ select: { id: true, name: true, ratePercentage: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({
      where: { id: { not: id }, isComposite: false, isActive: true },
      select: { id: true, name: true, sku: true },
      orderBy: { name: "asc" },
    }),
    prisma.inventory.findMany({
      where: {
        locationId: DEFAULT_LOCATION_ID,
        productId: id,
      },
      select: { variantId: true, quantityOnHand: true },
    }),
  ]);

  const baseStock = inventoryRows.find((r) => r.variantId === null)?.quantityOnHand.toNumber() ?? 0;
  const stockByVariant = new Map(
    inventoryRows.filter((r) => r.variantId !== null).map((r) => [r.variantId as number, r.quantityOnHand.toNumber()]),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Edit product"
        subtitle={product.sku}
        backHref="/products"
        backLabel="Back to products"
      />

      <Banner error={sp.error} success={sp.success} />

      <ProductPerformanceCard productId={product.id} range={parseProductSeriesRange(sp.range)} />

      <Card>
        <form action={updateProduct.bind(null, product.id)} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="SKU" name="sku" required defaultValue={product.sku} />
            <Field label="Barcode" name="barcode" defaultValue={product.barcode ?? ""} />
          </div>

          <Field label="Name" name="name" required defaultValue={product.name} />

          <div className="flex flex-col gap-1">
            <label htmlFor="description" className="text-xs font-medium text-text-muted">
              Description
            </label>
            <Textarea id="description" name="description" rows={2} defaultValue={product.description ?? ""} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="categoryId" className="text-xs font-medium text-text-muted">
                Category
              </label>
              <Select id="categoryId" name="categoryId" defaultValue={product.categoryId ?? ""}>
                <option value="">None</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="taxClassId" className="text-xs font-medium text-text-muted">
                Tax class
              </label>
              <Select id="taxClassId" name="taxClassId" defaultValue={product.taxClassId ?? ""}>
                <option value="">None</option>
                {taxClasses.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.ratePercentage.toString()}%)
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field
              label="Cost price"
              name="costPrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={product.costPrice.toString()}
            />
            <Field
              label="Sell price"
              name="sellPrice"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={product.sellPrice.toString()}
            />
            <Field
              label="Reorder threshold"
              name="reorderThreshold"
              type="number"
              step="1"
              min="0"
              defaultValue={String(product.reorderThreshold)}
            />
          </div>

          <ProductImageField defaultValue={product.imageUrl ?? ""} productName={product.name} />

          <div className="flex flex-wrap gap-6 pt-2">
            <Checkbox label="Track stock" name="trackStock" defaultChecked={product.trackStock} />
            <Checkbox label="Composite / bundle product" name="isComposite" defaultChecked={product.isComposite} />
            <Checkbox label="Active" name="isActive" defaultChecked={product.isActive} />
          </div>

          <div className="pt-2">
            <Button type="submit">Save changes</Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="mb-1 text-sm font-semibold text-text">Stock at Main Store</h2>
        <p className="mb-4 text-sm text-text">
          Base unit:{" "}
          <span className={baseStock < 0 ? "font-medium text-danger" : "font-medium text-text"}>{baseStock}</span>{" "}
          {product.trackStock ? null : <span className="text-text-muted">(stock tracking off)</span>}
          {" — "}
          <LinkButton href="/inventory" variant="ghost" size="sm" className="inline-flex px-1">
            adjust stock
          </LinkButton>
        </p>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-text">
          Variants (alternate sell units, e.g. &ldquo;Case of 24&rdquo;)
        </h2>

        {product.variants.length > 0 && (
          <div className="mb-4">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell>SKU</TableHeaderCell>
                  <TableHeaderCell>Barcode</TableHeaderCell>
                  <TableHeaderCell className="text-right">Price override</TableHeaderCell>
                  <TableHeaderCell className="text-right">Units / parent</TableHeaderCell>
                  <TableHeaderCell className="text-right">Stock</TableHeaderCell>
                  <TableHeaderCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {product.variants.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.name}</TableCell>
                    <TableCell>{v.sku}</TableCell>
                    <TableCell className="text-text-muted">{v.barcode ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {v.priceOverride ? `₱${v.priceOverride.toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right">{v.unitsPerParent}</TableCell>
                    <TableCell className="text-right">{stockByVariant.get(v.id) ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <form action={deleteVariant.bind(null, product.id, v.id)}>
                        <Button type="submit" variant="danger" size="sm">
                          Delete
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <form action={addVariant.bind(null, product.id)} className="flex flex-wrap items-end gap-3">
          <Field label="Name" name="name" id="variant-name" required placeholder="e.g. Case of 24" small />
          <Field label="SKU" name="sku" id="variant-sku" required small />
          <Field label="Barcode" name="barcode" id="variant-barcode" small />
          <Field
            label="Price override"
            name="priceOverride"
            id="variant-priceOverride"
            type="number"
            step="0.01"
            min="0"
            small
          />
          <Field
            label="Units / parent"
            name="unitsPerParent"
            id="variant-unitsPerParent"
            type="number"
            step="1"
            min="1"
            defaultValue="1"
            small
          />
          <Button type="submit">Add variant</Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-1 text-sm font-semibold text-text">Bundle components</h2>
        <p className="mb-3 text-xs text-text-muted">
          Only used when &ldquo;Composite / bundle product&rdquo; is checked above. Stock deducts from these
          component products when this product is sold.
        </p>

        {product.components.length > 0 && (
          <div className="mb-4">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Component product</TableHeaderCell>
                  <TableHeaderCell className="text-right">Quantity</TableHeaderCell>
                  <TableHeaderCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {product.components.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <ProductLink productId={row.component.id}>{row.component.name}</ProductLink>{" "}
                      <span className="text-text-muted">({row.component.sku})</span>
                    </TableCell>
                    <TableCell className="text-right">{row.quantity.toString()}</TableCell>
                    <TableCell className="text-right">
                      <form action={removeComponent.bind(null, product.id, row.id)}>
                        <Button type="submit" variant="danger" size="sm">
                          Remove
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {candidateComponents.length === 0 ? (
          <p className="text-sm text-text-muted">No other non-composite products available to add as components.</p>
        ) : (
          <form action={addComponent.bind(null, product.id)} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="componentId" className="text-xs font-medium text-text-muted">
                Component product
              </label>
              <Select id="componentId" name="componentId" required className="w-56">
                <option value="">Select a product…</option>
                {candidateComponents.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.sku})
                  </option>
                ))}
              </Select>
            </div>
            <Field
              label="Quantity"
              name="quantity"
              id="component-quantity"
              type="number"
              step="0.001"
              min="0.001"
              defaultValue="1"
              small
            />
            <Button type="submit">Add component</Button>
          </form>
        )}
      </Card>
    </div>
  );
}

function Field({
  label,
  name,
  id,
  type = "text",
  required,
  placeholder,
  defaultValue,
  step,
  min,
  small,
}: {
  label: string;
  name: string;
  id?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  step?: string;
  min?: string;
  small?: boolean;
}) {
  const inputId = id ?? name;
  return (
    <div className={`flex flex-col gap-1 ${small ? "w-40" : ""}`}>
      <label htmlFor={inputId} className="text-xs font-medium text-text-muted">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      <Input
        id={inputId}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        step={step}
        min={min}
      />
    </div>
  );
}

function Checkbox({
  label,
  name,
  defaultChecked,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-text">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 cursor-pointer accent-primary"
      />
      {label}
    </label>
  );
}
