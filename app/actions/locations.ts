"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

/**
 * Full multi-location/register admin CRUD — additive to the existing
 * DEFAULT_LOCATION_ID / DEFAULT_REGISTER_ID = 1 assumption baked into the rest
 * of the app (sales.ts, inventory.ts, products.ts, etc.). This file does not
 * touch those constants or any transactional logic — it only lets an admin
 * create/edit additional Location rows and Register rows so the schema's
 * existing multi-store shape is actually reachable. Wiring a location-switcher
 * into the Sales Terminal / Inventory / elsewhere is out of scope here.
 *
 * Same FormData + redirect-with-?error=/?success= pattern as
 * app/actions/staff.ts and app/actions/settings.ts.
 */

// ---------- Locations ----------

export async function createLocation(formData: FormData) {
  const gate = await requireRole("canManageSettings");
  if (!gate.ok) {
    redirect(`/settings/locations?error=${encodeURIComponent(gate.message)}`);
  }

  const name = String(formData.get("name") ?? "").trim();
  const addressRaw = String(formData.get("address") ?? "").trim();

  if (!name) {
    redirect(`/settings/locations?error=${encodeURIComponent("Location name is required")}`);
  }

  const created = await prisma.location.create({
    data: { name, address: addressRaw || null },
  });

  revalidatePath("/settings/locations");
  redirect(`/settings/locations/${created.id}?success=${encodeURIComponent(`Location "${name}" created`)}`);
}

export async function updateLocation(id: number, formData: FormData) {
  const gate = await requireRole("canManageSettings");
  if (!gate.ok) {
    redirect(`/settings/locations/${id}?error=${encodeURIComponent(gate.message)}`);
  }

  const name = String(formData.get("name") ?? "").trim();
  const addressRaw = String(formData.get("address") ?? "").trim();
  const active = formData.get("active") === "on";

  if (!name) {
    redirect(`/settings/locations/${id}?error=${encodeURIComponent("Location name is required")}`);
  }

  await prisma.location.update({
    where: { id },
    data: { name, address: addressRaw || null, active },
  });

  revalidatePath("/settings/locations");
  revalidatePath(`/settings/locations/${id}`);
  redirect(`/settings/locations/${id}?success=${encodeURIComponent("Location updated")}`);
}

// ---------- Registers ----------
// No delete — a register referenced by historical Sale/Shift rows can never be
// safely hard-deleted. Only an isActive toggle is exposed, same soft-deactivate
// discipline as Product.isActive / PaymentMethod.isActive.

export async function createRegister(locationId: number, formData: FormData) {
  const gate = await requireRole("canManageSettings");
  if (!gate.ok) {
    redirect(`/settings/locations/${locationId}?error=${encodeURIComponent(gate.message)}`);
  }

  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    redirect(`/settings/locations/${locationId}?error=${encodeURIComponent("Register name is required")}`);
  }

  await prisma.register.create({
    data: { locationId, name },
  });

  revalidatePath(`/settings/locations/${locationId}`);
  redirect(`/settings/locations/${locationId}?success=${encodeURIComponent(`Register "${name}" added`)}`);
}

export async function toggleRegisterActive(locationId: number, registerId: number, formData: FormData) {
  const gate = await requireRole("canManageSettings");
  if (!gate.ok) {
    redirect(`/settings/locations/${locationId}?error=${encodeURIComponent(gate.message)}`);
  }

  const nextActive = formData.get("nextActive") === "true";

  await prisma.register.update({ where: { id: registerId }, data: { active: nextActive } });

  revalidatePath(`/settings/locations/${locationId}`);
  redirect(
    `/settings/locations/${locationId}?success=${encodeURIComponent(`Register ${nextActive ? "activated" : "deactivated"}`)}`,
  );
}
