"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

const BCRYPT_ROUNDS = 10;
const PIN_PATTERN = /^\d{4,6}$/;

function parseOptionalInt(raw: FormDataEntryValue | null): number | null {
  const str = String(raw ?? "").trim();
  if (!str) return null;
  const n = Number(str);
  return Number.isNaN(n) ? null : n;
}

/** Shared field extraction for create/update staff forms — never includes password/PIN. */
function extractStaffFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const emailRaw = String(formData.get("email") ?? "").trim().toLowerCase();
  const roleId = parseOptionalInt(formData.get("roleId"));
  const locationId = parseOptionalInt(formData.get("locationId"));
  const active = formData.get("active") === "on";

  return {
    name,
    email: emailRaw || null,
    roleId,
    locationId,
    active,
  };
}

export async function createStaff(formData: FormData) {
  const gate = await requireRole("canManageUsers");
  if (!gate.ok) {
    redirect(`/staff?error=${encodeURIComponent(gate.message)}`);
  }

  const fields = extractStaffFields(formData);
  const password = String(formData.get("password") ?? "");

  if (!fields.name || !fields.roleId) {
    redirect(`/staff/new?error=${encodeURIComponent("Name and role are required")}`);
  }
  if (password.length < 6) {
    redirect(`/staff/new?error=${encodeURIComponent("Password must be at least 6 characters")}`);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  let created;
  try {
    created = await prisma.user.create({
      data: {
        name: fields.name,
        email: fields.email,
        passwordHash,
        roleId: fields.roleId!,
        locationId: fields.locationId,
        active: fields.active,
      },
    });
  } catch {
    redirect(`/staff/new?error=${encodeURIComponent("Could not create staff member — email may already be in use")}`);
  }

  revalidatePath("/staff");
  redirect(`/staff/${created.id}?success=${encodeURIComponent("Staff member created")}`);
}

/** Updates profile fields only — never touches passwordHash/pinHash (see setPin/removePin). */
export async function updateStaff(id: number, formData: FormData) {
  const gate = await requireRole("canManageUsers");
  if (!gate.ok) {
    redirect(`/staff/${id}?error=${encodeURIComponent(gate.message)}`);
  }

  const fields = extractStaffFields(formData);

  if (!fields.name || !fields.roleId) {
    redirect(`/staff/${id}?error=${encodeURIComponent("Name and role are required")}`);
  }

  try {
    await prisma.user.update({
      where: { id },
      data: {
        name: fields.name,
        email: fields.email,
        roleId: fields.roleId!,
        locationId: fields.locationId,
        active: fields.active,
      },
    });
  } catch {
    redirect(`/staff/${id}?error=${encodeURIComponent("Could not update staff member — email may already be in use")}`);
  }

  revalidatePath("/staff");
  revalidatePath(`/staff/${id}`);
  redirect(`/staff/${id}?success=${encodeURIComponent("Staff member updated")}`);
}

/**
 * Sets (or replaces) a user's PIN. PIN must be 4-6 digits, numeric only — matches the
 * bcrypt.compare loop in app/api/auth/pin/route.ts, which is the only consumer of pinHash.
 * Never logs or echoes the plaintext PIN back to the client.
 */
export async function setPin(id: number, formData: FormData) {
  const gate = await requireRole("canManageUsers");
  if (!gate.ok) {
    redirect(`/staff/${id}?error=${encodeURIComponent(gate.message)}`);
  }

  const pin = String(formData.get("pin") ?? "").trim();
  const confirmPin = String(formData.get("confirmPin") ?? "").trim();

  if (!PIN_PATTERN.test(pin)) {
    redirect(`/staff/${id}?error=${encodeURIComponent("PIN must be 4 to 6 digits")}`);
  }
  if (pin !== confirmPin) {
    redirect(`/staff/${id}?error=${encodeURIComponent("PIN and confirmation do not match")}`);
  }

  const pinHash = await bcrypt.hash(pin, BCRYPT_ROUNDS);
  await prisma.user.update({ where: { id }, data: { pinHash } });

  revalidatePath(`/staff/${id}`);
  redirect(`/staff/${id}?success=${encodeURIComponent("PIN updated")}`);
}

/** Disables PIN login for a user until a new PIN is set via setPin. */
export async function removePin(id: number) {
  const gate = await requireRole("canManageUsers");
  if (!gate.ok) {
    redirect(`/staff/${id}?error=${encodeURIComponent(gate.message)}`);
  }

  await prisma.user.update({ where: { id }, data: { pinHash: null } });

  revalidatePath(`/staff/${id}`);
  redirect(`/staff/${id}?success=${encodeURIComponent("PIN removed")}`);
}
