import { prisma } from "@/lib/prisma";
import { createPurchaseOrder } from "@/app/actions/purchase-orders";
import Banner from "@/app/components/Banner";
import Card from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Select from "@/app/components/ui/Select";
import Button, { LinkButton } from "@/app/components/ui/Button";
import PageHeader from "@/app/components/ui/PageHeader";
import EmptyState from "@/app/components/ui/EmptyState";

export default async function NewPurchaseOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; supplierId?: string }>;
}) {
  const params = await searchParams;
  const preselectedSupplierId = params.supplierId ? Number(params.supplierId) : null;

  const [suppliers, locations] = await Promise.all([
    prisma.supplier.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.location.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { id: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New purchase order"
        backHref="/purchase-orders"
        backLabel="Back to purchase orders"
      />

      <Banner error={params.error} />

      {suppliers.length === 0 ? (
        <EmptyState
          message="No suppliers yet"
          subMessage="Add a supplier before creating a purchase order."
          action={
            <LinkButton href="/suppliers" size="sm">
              Add a supplier
            </LinkButton>
          }
        />
      ) : (
        <Card className="max-w-xl">
          <form action={createPurchaseOrder} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="supplierId" className="text-xs font-medium text-text-muted">
                Supplier <span className="text-danger">*</span>
              </label>
              <Select id="supplierId" name="supplierId" required defaultValue={preselectedSupplierId ?? ""}>
                <option value="">Select a supplier…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="locationId" className="text-xs font-medium text-text-muted">
                Receiving location
              </label>
              <Select id="locationId" name="locationId" defaultValue={locations[0]?.id ?? ""}>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="expectedDate" className="text-xs font-medium text-text-muted">
                Expected date
              </label>
              <Input id="expectedDate" name="expectedDate" type="date" className="w-56" />
            </div>

            <p className="text-xs text-text-muted">
              The purchase order is created as a draft — line items are added on the next screen.
            </p>

            <div className="flex gap-3 pt-2">
              <Button type="submit">Create purchase order</Button>
              <LinkButton href="/purchase-orders" variant="secondary">
                Cancel
              </LinkButton>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
