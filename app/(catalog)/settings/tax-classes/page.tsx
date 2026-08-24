import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTaxClass, updateTaxClass } from "@/app/actions/settings";
import Banner from "@/app/components/Banner";
import PageHeader from "@/app/components/ui/PageHeader";
import Card from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Button, { LinkButton } from "@/app/components/ui/Button";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/app/components/ui/Table";

export default async function TaxClassesSettingsPage({
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

  const taxClasses = await prisma.taxClass.findMany({
    include: { _count: { select: { products: true, sales: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Tax configuration" backHref="/settings" backLabel="Settings" />

      <Banner error={sp.error} success={sp.success} />

      {/* No delete option — TaxClass has no isActive flag in the schema, so an
          unused-safe deactivate (like products/payment methods) isn't available
          for it yet. Edit rates directly instead. Intentionally kept visible. */}
      <p className="text-xs text-text-muted">
        No delete option — TaxClass has no isActive flag in the schema, so an unused-safe
        deactivate (like products/payment methods) isn&apos;t available for it yet. Edit rates
        directly instead.
      </p>

      <Card className="p-0">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell className="text-right">Rate %</TableHeaderCell>
              <TableHeaderCell>Inclusive</TableHeaderCell>
              <TableHeaderCell className="text-right">In use (products / sales)</TableHeaderCell>
              <TableHeaderCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {taxClasses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-text-muted">
                  No tax classes yet.
                </TableCell>
              </TableRow>
            ) : (
              taxClasses.map((t) =>
                editingId === t.id ? (
                  <TableRow key={t.id}>
                    <TableCell colSpan={5}>
                      <form action={updateTaxClass.bind(null, t.id)} className="flex flex-wrap items-end gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-text-muted">Name</label>
                          <Input name="name" defaultValue={t.name} required className="w-48" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-text-muted">Rate %</label>
                          <Input
                            name="ratePercentage"
                            type="number"
                            step="0.001"
                            min="0"
                            defaultValue={t.ratePercentage.toString()}
                            required
                            className="w-28"
                          />
                        </div>
                        <label className="flex min-h-11 items-center gap-2 text-sm text-text">
                          <input
                            type="checkbox"
                            name="isInclusive"
                            defaultChecked={t.isInclusive}
                            className="h-4 w-4 cursor-pointer accent-primary"
                          />
                          Inclusive
                        </label>
                        <Button type="submit" size="sm">
                          Save
                        </Button>
                        <LinkButton href="/settings/tax-classes" variant="ghost" size="sm">
                          Cancel
                        </LinkButton>
                      </form>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={t.id}>
                    <TableCell>{t.name}</TableCell>
                    <TableCell className="text-right">{t.ratePercentage.toString()}%</TableCell>
                    <TableCell>{t.isInclusive ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-right text-text-muted">
                      {t._count.products} / {t._count.sales}
                    </TableCell>
                    <TableCell className="text-right">
                      <LinkButton href={`/settings/tax-classes?edit=${t.id}`} variant="secondary" size="sm">
                        Edit
                      </LinkButton>
                    </TableCell>
                  </TableRow>
                ),
              )
            )}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <h2 className="mb-3 font-heading text-sm font-semibold text-text">Add tax class</h2>
        <form action={createTaxClass} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="text-xs font-medium text-text-muted">
              Name <span className="text-danger">*</span>
            </label>
            <Input id="name" name="name" required placeholder="e.g. Exempt" className="w-48" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="ratePercentage" className="text-xs font-medium text-text-muted">
              Rate % <span className="text-danger">*</span>
            </label>
            <Input
              id="ratePercentage"
              name="ratePercentage"
              type="number"
              step="0.001"
              min="0"
              required
              className="w-28"
            />
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm text-text">
            <input type="checkbox" name="isInclusive" className="h-4 w-4 cursor-pointer accent-primary" />
            Inclusive
          </label>
          <Button type="submit">Add tax class</Button>
        </form>
      </Card>
    </div>
  );
}
