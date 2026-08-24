import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { updateStaff, setPin, removePin } from "@/app/actions/staff";
import Banner from "@/app/components/Banner";
import Card from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Select from "@/app/components/ui/Select";
import Button from "@/app/components/ui/Button";
import Badge from "@/app/components/ui/Badge";
import PageHeader from "@/app/components/ui/PageHeader";
import EmptyState from "@/app/components/ui/EmptyState";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/app/components/ui/Table";
import { LockIcon } from "@/app/components/ui/icons";

export default async function EditStaffPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const gate = await requireRole("canManageUsers");
  if (!gate.ok) {
    redirect(`/dashboard?error=${encodeURIComponent(gate.message)}`);
  }

  const { id: idParam } = await params;
  const sp = await searchParams;
  const id = Number(idParam);
  if (Number.isNaN(id)) notFound();

  const [staff, roles, locations] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: {
        timeClockEntries: {
          orderBy: { clockIn: "desc" },
          take: 10,
        },
      },
    }),
    prisma.role.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.location.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!staff) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Staff member"
        subtitle={staff.name}
        backHref="/staff"
        backLabel="Back to staff"
        actions={<Badge variant={staff.active ? "success" : "neutral"}>{staff.active ? "Active" : "Inactive"}</Badge>}
      />

      <Banner error={sp.error} success={sp.success} />

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-text">Profile</h2>
        <form action={updateStaff.bind(null, staff.id)} className="flex max-w-xl flex-col gap-4">
          <Field label="Name" name="name" required defaultValue={staff.name} />
          <Field label="Email" name="email" type="email" defaultValue={staff.email ?? ""} />

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="roleId" className="text-xs font-medium text-text-muted">
                Role <span className="text-danger">*</span>
              </label>
              <Select id="roleId" name="roleId" required defaultValue={staff.roleId}>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="locationId" className="text-xs font-medium text-text-muted">
                Location
              </label>
              <Select id="locationId" name="locationId" defaultValue={staff.locationId ?? ""}>
                <option value="">None</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <Checkbox label="Active" name="active" defaultChecked={staff.active} />

          <div className="pt-2">
            <Button type="submit">Save changes</Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-text">
          <LockIcon className="h-4 w-4 text-text-muted" />
          PIN (quick-switch / register login)
        </h2>
        <p className="mb-4 text-xs text-text-muted">
          {staff.pinHash
            ? "A PIN is currently set for this user. Setting a new one below replaces it immediately."
            : "No PIN is set — this user cannot use PIN quick-switch until one is set."}
        </p>

        <form action={setPin.bind(null, staff.id)} className="mb-4 flex flex-wrap items-end gap-3">
          <Field
            label="New PIN"
            name="pin"
            id="pin"
            type="password"
            inputMode="numeric"
            pattern="\d{4,6}"
            minLength={4}
            maxLength={6}
            required
            placeholder="4-6 digits"
            small
            autoComplete="off"
          />
          <Field
            label="Confirm PIN"
            name="confirmPin"
            id="confirmPin"
            type="password"
            inputMode="numeric"
            pattern="\d{4,6}"
            minLength={4}
            maxLength={6}
            required
            placeholder="4-6 digits"
            small
            autoComplete="off"
          />
          <Button type="submit">{staff.pinHash ? "Replace PIN" : "Set PIN"}</Button>
        </form>

        {staff.pinHash && (
          <form action={removePin.bind(null, staff.id)}>
            <Button type="submit" variant="danger" size="sm">
              Remove PIN
            </Button>
          </form>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-text">Recent time clock entries</h2>
        {staff.timeClockEntries.length === 0 ? (
          <EmptyState message="No time clock entries yet" />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Clock in</TableHeaderCell>
                <TableHeaderCell>Clock out</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {staff.timeClockEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-text-muted">{new Date(entry.clockIn).toLocaleString()}</TableCell>
                  <TableCell className="text-text-muted">
                    {entry.clockOut ? new Date(entry.clockOut).toLocaleString() : <Badge variant="info">Open</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
  small,
  inputMode,
  pattern,
  minLength,
  maxLength,
  autoComplete,
}: {
  label: string;
  name: string;
  id?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number;
  small?: boolean;
  inputMode?: "numeric";
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  autoComplete?: string;
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
        inputMode={inputMode}
        pattern={pattern}
        minLength={minLength}
        maxLength={maxLength}
        autoComplete={autoComplete}
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
