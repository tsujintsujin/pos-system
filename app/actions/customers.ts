"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, getCurrentUser } from "@/lib/auth";

function parseOptionalInt(raw: FormDataEntryValue | null): number | null {
  const str = String(raw ?? "").trim();
  if (!str) return null;
  const n = Number(str);
  return Number.isNaN(n) ? null : n;
}

function extractCustomerFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const emailRaw = String(formData.get("email") ?? "").trim();
  const customerGroupId = parseOptionalInt(formData.get("customerGroupId"));

  return {
    name,
    phone: phoneRaw || null,
    email: emailRaw || null,
    customerGroupId,
  };
}

export async function createCustomer(formData: FormData) {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    redirect(`/customers?error=${encodeURIComponent(gate.message)}`);
  }

  const fields = extractCustomerFields(formData);

  if (!fields.name) {
    redirect(`/customers?error=${encodeURIComponent("Customer name is required")}`);
  }

  let created;
  try {
    created = await prisma.customer.create({ data: fields });
  } catch {
    redirect(`/customers?error=${encodeURIComponent("Could not create customer — phone number may already be in use")}`);
  }

  revalidatePath("/customers");
  redirect(`/customers/${created.id}?success=${encodeURIComponent("Customer created")}`);
}

export async function updateCustomer(id: number, formData: FormData) {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    redirect(`/customers/${id}?error=${encodeURIComponent(gate.message)}`);
  }

  const fields = extractCustomerFields(formData);

  if (!fields.name) {
    redirect(`/customers/${id}?error=${encodeURIComponent("Customer name is required")}`);
  }

  try {
    await prisma.customer.update({ where: { id }, data: fields });
  } catch {
    redirect(`/customers/${id}?error=${encodeURIComponent("Could not update customer — phone number may already be in use")}`);
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}?success=${encodeURIComponent("Customer updated")}`);
}

/**
 * Non-redirecting create, used for the Sales Terminal's inline quick-add (a client
 * component calling this directly via useTransition, the same pattern as
 * holdSale/completeSale in app/actions/sales.ts) — throws on failure instead of
 * redirecting, since there's no page navigation involved.
 *
 * Deliberately NOT gated by canAccessBackOffice (unlike every other write in this file) —
 * a CASHIER (all Role flags false) must be able to create a new customer mid-checkout,
 * same two-tier reasoning as the sales terminal actions in app/actions/sales.ts. Still
 * requires *some* authenticated session.
 */
export async function quickAddCustomer(input: { name: string; phone: string | null; email: string | null }) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Not authenticated");
  }

  const name = input.name.trim();
  if (!name) {
    throw new Error("Customer name is required");
  }

  try {
    const customer = await prisma.customer.create({
      data: { name, phone: input.phone?.trim() || null, email: input.email?.trim() || null },
    });
    revalidatePath("/customers");
    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
    };
  } catch {
    throw new Error("Could not create customer — phone number may already be in use");
  }
}

// ---------- Customer groups ----------

export async function createCustomerGroup(formData: FormData) {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    redirect(`/customers/groups?error=${encodeURIComponent(gate.message)}`);
  }

  const name = String(formData.get("name") ?? "").trim();
  const discountRaw = String(formData.get("discountPercentage") ?? "0").trim();
  const discount = Number.isNaN(Number(discountRaw)) ? "0" : discountRaw;

  if (!name) {
    redirect(`/customers/groups?error=${encodeURIComponent("Group name is required")}`);
  }

  await prisma.customerGroup.create({ data: { name, discountPercentage: discount } });

  revalidatePath("/customers/groups");
  revalidatePath("/customers");
  redirect(`/customers/groups?success=${encodeURIComponent(`Group "${name}" created`)}`);
}

export async function updateCustomerGroup(id: number, formData: FormData) {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    redirect(`/customers/groups?error=${encodeURIComponent(gate.message)}`);
  }

  const name = String(formData.get("name") ?? "").trim();
  const discountRaw = String(formData.get("discountPercentage") ?? "0").trim();
  const discount = Number.isNaN(Number(discountRaw)) ? "0" : discountRaw;

  if (!name) {
    redirect(`/customers/groups?error=${encodeURIComponent("Group name is required")}`);
  }

  await prisma.customerGroup.update({ where: { id }, data: { name, discountPercentage: discount } });

  revalidatePath("/customers/groups");
  revalidatePath("/customers");
  redirect(`/customers/groups?success=${encodeURIComponent("Group updated")}`);
}

export async function deleteCustomerGroup(id: number) {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    redirect(`/customers/groups?error=${encodeURIComponent(gate.message)}`);
  }

  const customerCount = await prisma.customer.count({ where: { customerGroupId: id } });
  if (customerCount > 0) {
    redirect(
      `/customers/groups?error=${encodeURIComponent("Cannot delete a group that still has customers assigned — reassign them first")}`,
    );
  }

  await prisma.customerGroup.delete({ where: { id } });

  revalidatePath("/customers/groups");
  revalidatePath("/customers");
  redirect(`/customers/groups?success=${encodeURIComponent("Group deleted")}`);
}
