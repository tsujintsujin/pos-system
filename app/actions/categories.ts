"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

/**
 * All category mutations redirect back to /categories with ?error= or ?success=
 * query params rather than using useActionState — keeps the pages plain server
 * components (no client-side form-state wiring needed for a back-office CRUD screen).
 */

export async function createCategory(formData: FormData) {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    redirect(`/categories?error=${encodeURIComponent(gate.message)}`);
  }

  const name = String(formData.get("name") ?? "").trim();
  const parentIdRaw = String(formData.get("parentId") ?? "");
  const parentId = parentIdRaw ? Number(parentIdRaw) : null;

  if (!name) {
    redirect(`/categories?error=${encodeURIComponent("Category name is required")}`);
  }

  if (parentId !== null && Number.isNaN(parentId)) {
    redirect(`/categories?error=${encodeURIComponent("Invalid parent category")}`);
  }

  await prisma.category.create({ data: { name, parentId } });

  revalidatePath("/categories");
  revalidatePath("/products");
  redirect(`/categories?success=${encodeURIComponent(`Category "${name}" created`)}`);
}

export async function updateCategory(id: number, formData: FormData) {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    redirect(`/categories?error=${encodeURIComponent(gate.message)}`);
  }

  const name = String(formData.get("name") ?? "").trim();
  const parentIdRaw = String(formData.get("parentId") ?? "");
  const parentId = parentIdRaw ? Number(parentIdRaw) : null;

  if (!name) {
    redirect(`/categories?error=${encodeURIComponent("Category name is required")}`);
  }

  if (parentId === id) {
    redirect(`/categories?error=${encodeURIComponent("A category cannot be its own parent")}`);
  }

  await prisma.category.update({ where: { id }, data: { name, parentId } });

  revalidatePath("/categories");
  revalidatePath("/products");
  redirect(`/categories?success=${encodeURIComponent(`Category "${name}" updated`)}`);
}

export async function deleteCategory(id: number) {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    redirect(`/categories?error=${encodeURIComponent(gate.message)}`);
  }

  const [childCount, productCount] = await Promise.all([
    prisma.category.count({ where: { parentId: id } }),
    prisma.product.count({ where: { categoryId: id } }),
  ]);

  if (childCount > 0) {
    redirect(
      `/categories?error=${encodeURIComponent("Cannot delete a category that has subcategories — move or delete them first")}`,
    );
  }
  if (productCount > 0) {
    redirect(
      `/categories?error=${encodeURIComponent("Cannot delete a category that still has products assigned — reassign them first")}`,
    );
  }

  await prisma.category.delete({ where: { id } });

  revalidatePath("/categories");
  revalidatePath("/products");
  redirect(`/categories?success=${encodeURIComponent("Category deleted")}`);
}
