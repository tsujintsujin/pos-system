import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createDiscount, updateDiscount, toggleDiscountActive } from "@/app/actions/discounts";
import Banner from "@/app/components/Banner";
import PageHeader from "@/app/components/ui/PageHeader";
import Card from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Select from "@/app/components/ui/Select";
import Badge from "@/app/components/ui/Badge";
import Button, { LinkButton } from "@/app/components/ui/Button";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/app/components/ui/Table";

/** YYYY-MM-DD for <input type="date"> defaultValue. */
function toDateInputValue(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export default async function DiscountsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; edit?: string }>;
}) {
  const gate = await requireRole("canManageSettings");
  if (!gate.ok) {
    redirect(`/dashboard?error=${encodeURIComponent(gate.message)}`);
  }

  const sp = await searchParams;
  const editingId = sp.edit ? Number(sp.edit) : null;

  const discounts = await prisma.discount.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Discounts" backHref="/settings" backLabel="Settings" />

      <Banner error={sp.error} success={sp.success} />

      {/* Schema constraint: Discount has no relation to Product/Category/SaleLineItem —
          "Applies to" is metadata only, not enforced anywhere. Only CART-scoped active
          discounts are offered as quick-picks in the Sales Terminal, since those need no
          product/category linkage to apply correctly. PRODUCT/CATEGORY discounts can still
          be created and tracked here for record-keeping. */}
      <p className="text-xs text-text-muted">
        &quot;Applies to&quot; is descriptive only — the schema has no link from a discount to a
        specific product or category, so PRODUCT/CATEGORY discounts can be created here but
        aren&apos;t applied anywhere yet. Only active <strong>Cart</strong>-scoped discounts appear
        as quick-picks in the Sales Terminal.
      </p>

      <Card className="p-0">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell className="text-right">Value</TableHeaderCell>
              <TableHeaderCell>Applies to</TableHeaderCell>
              <TableHeaderCell>Dates</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {discounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-text-muted">
                  No discounts yet.
                </TableCell>
              </TableRow>
            ) : (
              discounts.map((d) =>
                editingId === d.id ? (
                  <TableRow key={d.id}>
                    <TableCell colSpan={7}>
                      <form
                        action={updateDiscount.bind(null, d.id)}
                        className="flex flex-wrap items-end gap-3"
                      >
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-text-muted">Name</label>
                          <Input name="name" defaultValue={d.name} required className="w-44" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-text-muted">Type</label>
                          <Select name="type" defaultValue={d.type} className="w-32">
                            <option value="PERCENTAGE">Percentage</option>
                            <option value="FIXED">Fixed</option>
                          </Select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-text-muted">Value</label>
                          <Input
                            name="value"
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue={d.value.toString()}
                            required
                            className="w-24"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-text-muted">Applies to</label>
                          <Select name="appliesTo" defaultValue={d.appliesTo} className="w-32">
                            <option value="CART">Cart</option>
                            <option value="PRODUCT">Product</option>
                            <option value="CATEGORY">Category</option>
                          </Select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-text-muted">Start date</label>
                          <Input
                            name="startDate"
                            type="date"
                            defaultValue={toDateInputValue(d.startDate)}
                            className="w-40"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-text-muted">End date</label>
                          <Input
                            name="endDate"
                            type="date"
                            defaultValue={toDateInputValue(d.endDate)}
                            className="w-40"
                          />
                        </div>
                        <label className="flex min-h-11 items-center gap-2 text-sm text-text">
                          <input
                            type="checkbox"
                            name="active"
                            defaultChecked={d.active}
                            className="h-4 w-4 cursor-pointer accent-primary"
                          />
                          Active
                        </label>
                        <Button type="submit" size="sm">
                          Save
                        </Button>
                        <LinkButton href="/settings/discounts" variant="ghost" size="sm">
                          Cancel
                        </LinkButton>
                      </form>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium text-text">{d.name}</TableCell>
                    <TableCell className="text-text-muted">
                      {d.type === "PERCENTAGE" ? "Percentage" : "Fixed"}
                    </TableCell>
                    <TableCell className="text-right text-text-muted">
                      {d.type === "PERCENTAGE" ? `${d.value.toString()}%` : `₱${d.value.toString()}`}
                    </TableCell>
                    <TableCell>
                      <Badge variant={d.appliesTo === "CART" ? "info" : "neutral"}>
                        {d.appliesTo === "CART" ? "Cart" : d.appliesTo === "PRODUCT" ? "Product" : "Category"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-text-muted">
                      {d.startDate || d.endDate
                        ? `${toDateInputValue(d.startDate) || "—"} → ${toDateInputValue(d.endDate) || "—"}`
                        : "Always"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={d.active ? "success" : "neutral"}>
                        {d.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <LinkButton href={`/settings/discounts?edit=${d.id}`} variant="secondary" size="sm">
                          Edit
                        </LinkButton>
                        <form action={toggleDiscountActive.bind(null, d.id)} className="inline-block">
                          <input type="hidden" name="nextActive" value={d.active ? "false" : "true"} />
                          <Button type="submit" size="sm" variant={d.active ? "danger" : "secondary"}>
                            {d.active ? "Deactivate" : "Activate"}
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ),
              )
            )}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <h2 className="mb-3 font-heading text-sm font-semibold text-text">Add discount</h2>
        <form action={createDiscount} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="text-xs font-medium text-text-muted">
              Name <span className="text-danger">*</span>
            </label>
            <Input id="name" name="name" required placeholder="e.g. Loyalty 10%" className="w-44" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="type" className="text-xs font-medium text-text-muted">
              Type
            </label>
            <Select id="type" name="type" defaultValue="PERCENTAGE" className="w-32">
              <option value="PERCENTAGE">Percentage</option>
              <option value="FIXED">Fixed</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="value" className="text-xs font-medium text-text-muted">
              Value <span className="text-danger">*</span>
            </label>
            <Input
              id="value"
              name="value"
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="10"
              className="w-24"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="appliesTo" className="text-xs font-medium text-text-muted">
              Applies to
            </label>
            <Select id="appliesTo" name="appliesTo" defaultValue="CART" className="w-32">
              <option value="CART">Cart</option>
              <option value="PRODUCT">Product</option>
              <option value="CATEGORY">Category</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="startDate" className="text-xs font-medium text-text-muted">
              Start date
            </label>
            <Input id="startDate" name="startDate" type="date" className="w-40" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="endDate" className="text-xs font-medium text-text-muted">
              End date
            </label>
            <Input id="endDate" name="endDate" type="date" className="w-40" />
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm text-text">
            <input type="checkbox" name="active" defaultChecked className="h-4 w-4 cursor-pointer accent-primary" />
            Active
          </label>
          <Button type="submit">Add discount</Button>
        </form>
      </Card>
    </div>
  );
}
