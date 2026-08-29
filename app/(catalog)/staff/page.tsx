import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import Banner from "@/app/components/Banner";
import Badge from "@/app/components/ui/Badge";
import { LinkButton } from "@/app/components/ui/Button";
import PageHeader from "@/app/components/ui/PageHeader";
import EmptyState from "@/app/components/ui/EmptyState";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/app/components/ui/Table";
import TableFilterInput from "@/app/components/ui/TableFilterInput";
import SortableHeaderCell from "@/app/components/ui/SortableHeaderCell";
import TablePagination from "@/app/components/ui/TablePagination";
import {
  containsInsensitive,
  clampPage,
  paginate,
  parsePage,
  parsePageSize,
  parseSort,
} from "@/lib/list-params";

const SORT_COLUMNS = ["name", "email", "role", "location", "status"] as const;
type SortColumn = (typeof SORT_COLUMNS)[number];

function orderByFor(key: SortColumn, dir: "asc" | "desc"): Prisma.UserOrderByWithRelationInput {
  switch (key) {
    case "email":
      return { email: dir };
    case "role":
      return { role: { name: dir } };
    case "location":
      return { location: { name: dir } };
    case "status":
      return { active: dir };
    default:
      return { name: dir };
  }
}

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    sort?: string;
    dir?: string;
    page?: string;
    size?: string;
    error?: string;
    success?: string;
  }>;
}) {
  const gate = await requireRole("canManageUsers");
  if (!gate.ok) {
    redirect(`/dashboard?error=${encodeURIComponent(gate.message)}`);
  }

  const params = await searchParams;
  const q = (params.q ?? "").trim();

  const sort = parseSort(params.sort, params.dir, SORT_COLUMNS, { key: "name", dir: "asc" });
  const pageSize = parsePageSize(params.size);

  const where: Prisma.UserWhereInput = q
    ? { OR: [{ name: containsInsensitive(q) }, { email: containsInsensitive(q) }] }
    : {};

  const total = await prisma.user.count({ where });
  const page = clampPage(parsePage(params.page), total, pageSize);
  const staff = await prisma.user.findMany({
    where,
    include: {
      role: { select: { name: true } },
      location: { select: { name: true } },
      timeClockEntries: {
        where: { clockOut: null },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: orderByFor(sort.key, sort.dir),
    ...paginate(page, pageSize),
  });

  const sortProps = { activeColumn: params.sort ?? null, activeDirection: sort.dir };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Staff"
        subtitle={`${total} staff member${total === 1 ? "" : "s"}`}
        actions={
          <LinkButton href="/staff/new" size="sm">
            Add staff member
          </LinkButton>
        }
      />

      <Banner error={params.error} success={params.success} />

      <div className="flex flex-wrap items-end gap-3">
        <TableFilterInput
          name="q"
          label="Search (name / email)"
          placeholder="Search staff…"
          defaultValue={q}
          className="w-64"
        />
        {q && (
          <LinkButton href="/staff" variant="ghost" size="sm">
            Clear
          </LinkButton>
        )}
      </div>

      {total === 0 ? (
        <EmptyState
          message={q ? "No staff match this search" : "No staff members yet"}
          subMessage={q ? "Try a different search." : "Add one to get started."}
        />
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <SortableHeaderCell column="name" {...sortProps}>
                  Name
                </SortableHeaderCell>
                <SortableHeaderCell column="email" {...sortProps}>
                  Email
                </SortableHeaderCell>
                <SortableHeaderCell column="role" {...sortProps}>
                  Role
                </SortableHeaderCell>
                <SortableHeaderCell column="location" {...sortProps}>
                  Location
                </SortableHeaderCell>
                <SortableHeaderCell column="status" {...sortProps}>
                  Status
                </SortableHeaderCell>
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
                    <Badge variant={s.active ? "success" : "neutral"}>
                      {s.active ? "Active" : "Inactive"}
                    </Badge>
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

          <TablePagination storageKey="staff" page={page} pageSize={pageSize} total={total} />
        </>
      )}
    </div>
  );
}
