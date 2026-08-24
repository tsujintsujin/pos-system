import { prisma } from "@/lib/prisma";
import { createProduct } from "@/app/actions/products";
import Banner from "@/app/components/Banner";
import Card from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Select from "@/app/components/ui/Select";
import Textarea from "@/app/components/ui/Textarea";
import Button, { LinkButton } from "@/app/components/ui/Button";
import PageHeader from "@/app/components/ui/PageHeader";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  const [categories, taxClasses] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.taxClass.findMany({ select: { id: true, name: true, ratePercentage: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="New product" backHref="/products" backLabel="Back to products" />

      <Banner error={params.error} />

      <Card className="flex max-w-2xl flex-col gap-4">
        <form action={createProduct} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="SKU" name="sku" required placeholder="e.g. BEV-001" />
            <Field label="Barcode" name="barcode" placeholder="e.g. 4801234567890" />
          </div>

          <Field label="Name" name="name" required placeholder="e.g. Cola 330ml" />

          <div className="flex flex-col gap-1">
            <label htmlFor="description" className="text-xs font-medium text-text-muted">
              Description
            </label>
            <Textarea id="description" name="description" rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="categoryId" className="text-xs font-medium text-text-muted">
                Category
              </label>
              <Select id="categoryId" name="categoryId">
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
              <Select id="taxClassId" name="taxClassId">
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
            <Field label="Cost price" name="costPrice" type="number" step="0.01" min="0" defaultValue="0" />
            <Field label="Sell price" name="sellPrice" type="number" step="0.01" min="0" required />
            <Field label="Reorder threshold" name="reorderThreshold" type="number" step="1" min="0" defaultValue="0" />
          </div>

          <Field
            label="Image URL"
            name="imageUrl"
            type="url"
            placeholder="https://example.com/product-photo.jpg"
          />
          <p className="-mt-2 text-xs text-text-muted">
            Link to an already-hosted image — this app has no file upload/storage set up.
          </p>

          <div className="flex flex-wrap gap-6 pt-2">
            <Checkbox label="Track stock" name="trackStock" defaultChecked />
            <Checkbox label="Composite / bundle product" name="isComposite" />
            <Checkbox label="Active" name="isActive" defaultChecked />
          </div>
          <p className="text-xs text-text-muted">
            Composite/bundle components and variants can be added after the product is created.
          </p>

          <div className="flex gap-3 pt-2">
            <Button type="submit">Create product</Button>
            <LinkButton href="/products" variant="secondary">
              Cancel
            </LinkButton>
          </div>
        </form>
      </Card>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  defaultValue,
  step,
  min,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  step?: string;
  min?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-xs font-medium text-text-muted">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      <Input
        id={name}
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
