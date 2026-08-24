import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { createLocation } from "@/app/actions/locations";
import Banner from "@/app/components/Banner";
import PageHeader from "@/app/components/ui/PageHeader";
import Card from "@/app/components/ui/Card";
import Badge from "@/app/components/ui/Badge";
import Button from "@/app/components/ui/Button";
import Input from "@/app/components/ui/Input";
import EmptyState from "@/app/components/ui/EmptyState";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/app/components/ui/Table";

export default async function LocationsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const gate = await requireRole("canManageSettings");
  if (!gate.ok) {
    redirect(`/dashboard?error=${encodeURIComponent(gate.message)}`);
  }

  const sp = await searchParams;

  const locations = await prisma.location.findMany({
    include: { _count: { select: { registers: true } } },
    orderBy: { id: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Locations" backHref="/settings" backLabel="Settings" />

      <Banner error={sp.error} success={sp.success} />

      <p className="text-xs text-text-muted">
        This screen manages the data model for future multi-store use. The rest of the app (Sales
        Terminal, Inventory, etc.) is still hardcoded to the primary location and register — creating
        a second location here does not make it usable anywhere else yet.
      </p>

      <Card className="p-0">
        {locations.length === 0 ? (
          <EmptyState message="No locations yet" />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Address</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell className="text-right">Registers</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {locations.map((loc) => (
                <TableRow key={loc.id}>
                  <TableCell>
                    <Link
                      href={`/settings/locations/${loc.id}`}
                      className="cursor-pointer font-medium text-text transition-colors duration-150 hover:text-primary hover:underline"
                    >
                      {loc.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-text-muted">{loc.address ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={loc.active ? "success" : "neutral"}>
                      {loc.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-text-muted">{loc._count.registers}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card className="max-w-2xl">
        <h2 className="mb-3 text-sm font-semibold text-text">Add a location</h2>
        <form action={createLocation} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="name" className="text-xs font-medium text-text-muted">
                Name <span className="text-danger">*</span>
              </label>
              <Input id="name" name="name" required placeholder="e.g. North Branch" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="address" className="text-xs font-medium text-text-muted">
                Address
              </label>
              <Input id="address" name="address" placeholder="e.g. 123 Main St." />
            </div>
          </div>
          <div>
            <Button type="submit">Create location</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
