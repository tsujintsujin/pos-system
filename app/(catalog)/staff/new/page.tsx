import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { createStaff } from "@/app/actions/staff";
import Banner from "@/app/components/Banner";
import Card from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Select from "@/app/components/ui/Select";
import Button, { LinkButton } from "@/app/components/ui/Button";
import PageHeader from "@/app/components/ui/PageHeader";

export default async function NewStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const gate = await requireRole("canManageUsers");
  if (!gate.ok) {
    redirect(`/dashboard?error=${encodeURIComponent(gate.message)}`);
  }

  const params = await searchParams;

  const [roles, locations] = await Promise.all([
    prisma.role.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.location.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Add staff member" backHref="/staff" backLabel="Back to staff" />

      <Banner error={params.error} />

      <Card className="flex max-w-2xl flex-col gap-4">
        <form action={createStaff} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name" name="name" required placeholder="e.g. Maria Santos" />
            <Field label="Email" name="email" type="email" placeholder="e.g. maria@possystem.local" />
          </div>

          <Field
            label="Password"
            name="password"
            type="password"
            required
            placeholder="At least 6 characters"
            autoComplete="new-password"
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="roleId" className="text-xs font-medium text-text-muted">
                Role <span className="text-danger">*</span>
              </label>
              <Select id="roleId" name="roleId" required defaultValue="">
                <option value="" disabled>
                  Select a role…
                </option>
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
              <Select id="locationId" name="locationId" defaultValue="">
                <option value="">None</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <Checkbox label="Active" name="active" defaultChecked />

          <p className="text-xs text-text-muted">
            A PIN for quick-switch / register login can be set after the staff member is created.
          </p>

          <div className="flex gap-3 pt-2">
            <Button type="submit">Create staff member</Button>
            <LinkButton href="/staff" variant="secondary">
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
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
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
