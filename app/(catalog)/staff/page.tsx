import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import Banner from "@/app/components/Banner";
import Badge from "@/app/components/ui/Badge";
import { LinkButton } from "@/app/components/ui/Button";
import PageHeader from "@/app/components/ui/PageHeader";
import EmptyState from "@/app/components/ui/EmptyState";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/app/components/ui/Table";

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const gate = await requireRole("canManageUsers");
  if (!gate.ok) {
    redirect(`/dashboard?error=${encodeURIComponent(gate.message)}`);
  }

  const params = await searchParams;

  const staff = await prisma.user.findMany({
    include: {
      role: { select: { name: true } },
      location: { select: { name: true } },
      timeClockEntries: {
        where: { clockOut: null },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Staff"
        subtitle={`${staff.length} staff member${staff.length === 1 ? "" : "s"}`}
        actions={
          <LinkButton href="/staff/new" size="sm">
            Add staff member
          </LinkButton>
        }
      />

      <Banner error={params.error} success={params.success} />

      {staff.length === 0 ? (
        <EmptyState message="No staff members yet" subMessage="Add one to get started." />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Email</TableHeaderCell>
              <TableHeaderCell>Role</TableHeaderCell>
              <TableHeaderCell>Location</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Clocked in</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {staff.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <Link
                    href={`/staff/${s.id}`}
                    className="cursor-pointer font-medium text-text transition-colors duration-150 hover:text-primary hover:underline"
                  >
                    {s.name}
                  </Link>
                </TableCell>
                <TableCell className="text-text-muted">{s.email ?? "—"}</TableCell>
                <TableCell className="text-text-muted">{s.role.name}</TableCell>
                <TableCell className="text-text-muted">{s.location?.name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={s.active ? "success" : "neutral"}>{s.active ? "Active" : "Inactive"}</Badge>
                </TableCell>
                <TableCell>
                  {s.timeClockEntries.length > 0 ? (
                    <Badge variant="info">Clocked in</Badge>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
