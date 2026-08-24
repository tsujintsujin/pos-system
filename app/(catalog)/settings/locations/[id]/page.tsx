import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { updateLocation, createRegister, toggleRegisterActive } from "@/app/actions/locations";
import Banner from "@/app/components/Banner";
import Card from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Button from "@/app/components/ui/Button";
import Badge from "@/app/components/ui/Badge";
import PageHeader from "@/app/components/ui/PageHeader";
import EmptyState from "@/app/components/ui/EmptyState";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/app/components/ui/Table";

export default async function EditLocationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const gate = await requireRole("canManageSettings");
  if (!gate.ok) {
    redirect(`/dashboard?error=${encodeURIComponent(gate.message)}`);
  }

  const { id: idParam } = await params;
  const sp = await searchParams;
  const id = Number(idParam);
  if (Number.isNaN(id)) notFound();

  const location = await prisma.location.findUnique({
    where: { id },
    include: { registers: { orderBy: { id: "asc" } } },
  });
  if (!location) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Location"
        subtitle={location.name}
        backHref="/settings/locations"
        backLabel="Back to locations"
        actions={
          <Badge variant={location.active ? "success" : "neutral"}>
            {location.active ? "Active" : "Inactive"}
          </Badge>
        }
      />

      <Banner error={sp.error} success={sp.success} />

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-text">Details</h2>
        <form action={updateLocation.bind(null, location.id)} className="flex max-w-xl flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="text-xs font-medium text-text-muted">
              Name <span className="text-danger">*</span>
            </label>
            <Input id="name" name="name" required defaultValue={location.name} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="address" className="text-xs font-medium text-text-muted">
              Address
            </label>
            <Input id="address" name="address" defaultValue={location.address ?? ""} />
          </div>

          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              name="active"
              defaultChecked={location.active}
              className="h-4 w-4 cursor-pointer accent-primary"
            />
            Active
          </label>

          <div className="pt-2">
            <Button type="submit">Save changes</Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="mb-1 text-sm font-semibold text-text">Registers</h2>
        <p className="mb-4 text-xs text-text-muted">
          No delete option — a register that has been used on any historical Sale or Shift row can&apos;t
          be safely removed. Deactivate it instead.
        </p>

        {location.registers.length === 0 ? (
          <EmptyState message="No registers yet" subMessage="Add one below." />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell className="text-right">Action</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {location.registers.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium text-text">{r.name}</TableCell>
                  <TableCell>
                    <Badge variant={r.active ? "success" : "neutral"}>
                      {r.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <form
                      action={toggleRegisterActive.bind(null, location.id, r.id)}
                      className="inline-block"
                    >
                      <input type="hidden" name="nextActive" value={r.active ? "false" : "true"} />
                      <Button type="submit" size="sm" variant={r.active ? "danger" : "secondary"}>
                        {r.active ? "Deactivate" : "Activate"}
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <form
          action={createRegister.bind(null, location.id)}
          className="mt-4 flex flex-wrap items-end gap-3"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="registerName" className="text-xs font-medium text-text-muted">
              New register name <span className="text-danger">*</span>
            </label>
            <Input id="registerName" name="name" required placeholder="e.g. Register 2" className="w-56" />
          </div>
          <Button type="submit">Add register</Button>
        </form>
      </Card>
    </div>
  );
}
