"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

function parseOptionalInt(raw: FormDataEntryValue | null): number | null {
  const str = String(raw ?? "").trim();
  if (!str) return null;
  const n = Number(str);
  return Number.isNaN(n) ? null : n;
}

function parseDecimalString(raw: FormDataEntryValue | null, fallback = "0"): string {
  const str = String(raw ?? "").trim();
  if (!str) return fallback;
  const n = Number(str);
  return Number.isNaN(n) ? fallback : str;
}

/** Shared field extraction for create/update product forms. */
function extractProductFields(formData: FormData) {
  const sku = String(formData.get("sku") ?? "").trim();
  const barcodeRaw = String(formData.get("barcode") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const imageUrlRaw = String(formData.get("imageUrl") ?? "").trim();
  const categoryId = parseOptionalInt(formData.get("categoryId"));
  const taxClassId = parseOptionalInt(formData.get("taxClassId"));
  const costPrice = parseDecimalString(formData.get("costPrice"), "0");
  const sellPrice = parseDecimalString(formData.get("sellPrice"), "");
  const reorderThresholdRaw = String(formData.get("reorderThreshold") ?? "0").trim();
  const reorderThreshold = Number.isNaN(Number(reorderThresholdRaw)) ? 0 : Math.trunc(Number(reorderThresholdRaw));
  const trackStock = formData.get("trackStock") === "on";
  const isComposite = formData.get("isComposite") === "on";
  const isActive = formData.get("isActive") === "on";

  return {
    sku,
    barcode: barcodeRaw || null,
    name,
    description: descriptionRaw || null,
    imageUrl: imageUrlRaw || null,
    categoryId,
    taxClassId,
    costPrice,
    sellPrice,
    reorderThreshold,
    trackStock,
    isComposite,
    isActive,
  };
}

export async function createProduct(formData: FormData) {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    redirect(`/products?error=${encodeURIComponent(gate.message)}`);
  }

  const fields = extractProductFields(formData);

  if (!fields.sku || !fields.name || !fields.sellPrice) {
    redirect(
      `/products/new?error=${encodeURIComponent("SKU, name, and sell price are required")}`,
    );
  }

  let created;
  try {
    created = await prisma.product.create({
      data: {
        sku: fields.sku,
        barcode: fields.barcode,
        name: fields.name,
        description: fields.description,
        imageUrl: fields.imageUrl,
        categoryId: fields.categoryId,
        taxClassId: fields.taxClassId,
        costPrice: fields.costPrice,
        sellPrice: fields.sellPrice,
        reorderThreshold: fields.reorderThreshold,
        trackStock: fields.trackStock,
        isComposite: fields.isComposite,
        isActive: fields.isActive,
      },
    });
  } catch {
    redirect(
      `/products/new?error=${encodeURIComponent("Could not create product — SKU or barcode may already be in use")}`,
    );
  }

  revalidatePath("/products");
  redirect(`/products/${created.id}?success=${encodeURIComponent("Product created")}`);
}

export async function updateProduct(id: number, formData: FormData) {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    redirect(`/products/${id}?error=${encodeURIComponent(gate.message)}`);
  }

  const fields = extractProductFields(formData);

  if (!fields.sku || !fields.name || !fields.sellPrice) {
    redirect(`/products/${id}?error=${encodeURIComponent("SKU, name, and sell price are required")}`);
  }

  try {
    await prisma.product.update({
      where: { id },
      data: {
        sku: fields.sku,
        barcode: fields.barcode,
        name: fields.name,
        description: fields.description,
        imageUrl: fields.imageUrl,
        categoryId: fields.categoryId,
        taxClassId: fields.taxClassId,
        costPrice: fields.costPrice,
        sellPrice: fields.sellPrice,
        reorderThreshold: fields.reorderThreshold,
        trackStock: fields.trackStock,
        isComposite: fields.isComposite,
        isActive: fields.isActive,
      },
    });
  } catch {
    redirect(
      `/products/${id}?error=${encodeURIComponent("Could not update product — SKU or barcode may already be in use")}`,
    );
  }

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  revalidatePath("/inventory");
  redirect(`/products/${id}?success=${encodeURIComponent("Product updated")}`);
}

// ---------- Variants ----------

export async function addVariant(productId: number, formData: FormData) {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    redirect(`/products/${productId}?error=${encodeURIComponent(gate.message)}`);
  }

  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const barcodeRaw = String(formData.get("barcode") ?? "").trim();
  const priceOverrideRaw = String(formData.get("priceOverride") ?? "").trim();
  const unitsPerParentRaw = String(formData.get("unitsPerParent") ?? "1").trim();
  const unitsPerParent = Number.isNaN(Number(unitsPerParentRaw)) ? 1 : Math.trunc(Number(unitsPerParentRaw));

  if (!name || !sku) {
    redirect(`/products/${productId}?error=${encodeURIComponent("Variant name and SKU are required")}`);
  }
  if (unitsPerParent < 1) {
    redirect(`/products/${productId}?error=${encodeURIComponent("Units per parent must be at least 1")}`);
  }

  try {
    const variant = await prisma.productVariant.create({
      data: {
        productId,
        name,
        sku,
        barcode: barcodeRaw || null,
        priceOverride: priceOverrideRaw || null,
        unitsPerParent,
      },
    });

    // Give the new variant an Inventory row (starting at 0) at every active location,
    // so /inventory can show and adjust it immediately without a separate first-touch upsert.
    const locations = await prisma.location.findMany({ where: { active: true }, select: { id: true } });
    if (locations.length > 0) {
      await prisma.inventory.createMany({
        data: locations.map((loc) => ({
          locationId: loc.id,
          productId,
          variantId: variant.id,
          quantityOnHand: 0,
        })),
        skipDuplicates: true,
      });
    }
  } catch {
    redirect(
      `/products/${productId}?error=${encodeURIComponent("Could not add variant — SKU or barcode may already be in use")}`,
    );
  }

  revalidatePath(`/products/${productId}`);
  revalidatePath("/inventory");
  redirect(`/products/${productId}?success=${encodeURIComponent("Variant added")}`);
}

export async function deleteVariant(productId: number, variantId: number) {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    redirect(`/products/${productId}?error=${encodeURIComponent(gate.message)}`);
  }

  try {
    await prisma.$transaction([
      prisma.inventory.deleteMany({ where: { variantId } }),
      prisma.productVariant.delete({ where: { id: variantId } }),
    ]);
  } catch {
    redirect(
      `/products/${productId}?error=${encodeURIComponent("Could not delete variant — it may already be referenced by a sale")}`,
    );
  }

  revalidatePath(`/products/${productId}`);
  revalidatePath("/inventory");
  redirect(`/products/${productId}?success=${encodeURIComponent("Variant deleted")}`);
}

// ---------- Composite / bundle components ----------

export async function addComponent(parentId: number, formData: FormData) {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    redirect(`/products/${parentId}?error=${encodeURIComponent(gate.message)}`);
  }

  const componentId = parseOptionalInt(formData.get("componentId"));
  const quantityRaw = String(formData.get("quantity") ?? "1").trim();

  if (!componentId) {
    redirect(`/products/${parentId}?error=${encodeURIComponent("Select a component product")}`);
  }
  if (componentId === parentId) {
    redirect(`/products/${parentId}?error=${encodeURIComponent("A product cannot be a component of itself")}`);
  }
  if (!quantityRaw || Number.isNaN(Number(quantityRaw)) || Number(quantityRaw) <= 0) {
    redirect(`/products/${parentId}?error=${encodeURIComponent("Component quantity must be greater than 0")}`);
  }

  await prisma.productComponent.create({
    data: { parentId, componentId, quantity: quantityRaw },
  });

  revalidatePath(`/products/${parentId}`);
  redirect(`/products/${parentId}?success=${encodeURIComponent("Component added")}`);
}

export async function removeComponent(parentId: number, componentRowId: number) {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    redirect(`/products/${parentId}?error=${encodeURIComponent(gate.message)}`);
  }

  await prisma.productComponent.delete({ where: { id: componentRowId } });

  revalidatePath(`/products/${parentId}`);
  redirect(`/products/${parentId}?success=${encodeURIComponent("Component removed")}`);
}
