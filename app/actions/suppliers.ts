"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

function extractSupplierFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const contactInfoRaw = String(formData.get("contactInfo") ?? "").trim();
  const paymentTermsRaw = String(formData.get("paymentTerms") ?? "").trim();

  return {
    name,
    contactInfo: contactInfoRaw || null,
    paymentTerms: paymentTermsRaw || null,
  };
}

export async function createSupplier(formData: FormData) {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    redirect(`/suppliers?error=${encodeURIComponent(gate.message)}`);
  }

  const fields = extractSupplierFields(formData);
  if (!fields.name) {
    redirect(`/suppliers?error=${encodeURIComponent("Supplier name is required")}`);
  }

  const created = await prisma.supplier.create({ data: fields });

  revalidatePath("/suppliers");
  redirect(`/suppliers/${created.id}?success=${encodeURIComponent("Supplier created")}`);
}

export async function updateSupplier(id: number, formData: FormData) {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    redirect(`/suppliers/${id}?error=${encodeURIComponent(gate.message)}`);
  }

  const fields = extractSupplierFields(formData);
  if (!fields.name) {
    redirect(`/suppliers/${id}?error=${encodeURIComponent("Supplier name is required")}`);
  }

  await prisma.supplier.update({ where: { id }, data: fields });

  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${id}`);
  redirect(`/suppliers/${id}?success=${encodeURIComponent("Supplier updated")}`);
}
