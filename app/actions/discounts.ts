"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { DiscountType, DiscountAppliesTo } from "@/app/generated/prisma/enums";

/**
 * Discount admin CRUD — gated with canManageSettings (same flag as tax classes/payment
 * methods; this is a pricing/promotions configuration screen, same category of admin
 * action). Same FormData + redirect-with-?error=/?success= pattern as app/actions/settings.ts.
 *
 * Schema note: Discount has no relation to Product/Category/SaleLineItem — appliesTo is
 * metadata only. The Sales Terminal quick-pick (DiscountControl) only lists+applies
 * active CART-scoped discounts for that reason; PRODUCT/CATEGORY discounts can still be
 * created/managed here for record-keeping but aren't enforced/applied anywhere yet.
 */

function isValidDiscountType(v: string): v is DiscountType {
  return v === DiscountType.PERCENTAGE || v === DiscountType.FIXED;
}

function isValidAppliesTo(v: string): v is DiscountAppliesTo {
  return (
    v === DiscountAppliesTo.PRODUCT ||
    v === DiscountAppliesTo.CATEGORY ||
    v === DiscountAppliesTo.CART
  );
}

/** Parse an optional <input type="date"> value into a Date or null. */
function parseOptionalDate(raw: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

type DiscountFormResult =
  | { ok: false; error: string }
  | {
      ok: true;
      data: {
        name: string;
        type: DiscountType;
        appliesTo: DiscountAppliesTo;
        value: string;
        startDate: Date | null;
        endDate: Date | null;
        active: boolean;
      };
    };

function readAndValidateDiscountForm(formData: FormData): DiscountFormResult {
  const name = String(formData.get("name") ?? "").trim();
  const typeRaw = String(formData.get("type") ?? "");
  const appliesToRaw = String(formData.get("appliesTo") ?? "");
  const valueRaw = String(formData.get("value") ?? "").trim();
  const startDateRaw = String(formData.get("startDate") ?? "").trim();
  const endDateRaw = String(formData.get("endDate") ?? "").trim();
  const active = formData.get("active") === "on";

  if (!name) {
    return { ok: false, error: "Discount name is required" };
  }
  if (!isValidDiscountType(typeRaw)) {
    return { ok: false, error: "Invalid discount type" };
  }
  if (!isValidAppliesTo(appliesToRaw)) {
    return { ok: false, error: "Invalid applies-to scope" };
  }

  const value = Number(valueRaw);
  if (!valueRaw || Number.isNaN(value) || value <= 0) {
    return { ok: false, error: "Value must be a positive number" };
  }
  if (typeRaw === DiscountType.PERCENTAGE && value > 100) {
    return { ok: false, error: "A percentage discount can't exceed 100%" };
  }

  const startDate = parseOptionalDate(startDateRaw);
  const endDate = parseOptionalDate(endDateRaw);
  if (startDate && endDate && startDate > endDate) {
    return { ok: false, error: "Start date must be before end date" };
  }

  return {
    ok: true,
    data: {
      name,
      type: typeRaw,
      appliesTo: appliesToRaw,
      value: valueRaw,
      startDate,
      endDate,
      active,
    },
  } as const;
}

export async function createDiscount(formData: FormData) {
  const gate = await requireRole("canManageSettings");
  if (!gate.ok) {
    redirect(`/settings/discounts?error=${encodeURIComponent(gate.message)}`);
  }

  const result = readAndValidateDiscountForm(formData);
  if (!result.ok) {
    redirect(`/settings/discounts?error=${encodeURIComponent(result.error)}`);
  }

  await prisma.discount.create({ data: result.data });

  revalidatePath("/settings/discounts");
  revalidatePath("/sales");
  redirect(`/settings/discounts?success=${encodeURIComponent(`Discount "${result.data.name}" created`)}`);
}

export async function updateDiscount(id: number, formData: FormData) {
  const gate = await requireRole("canManageSettings");
  if (!gate.ok) {
    redirect(`/settings/discounts?error=${encodeURIComponent(gate.message)}`);
  }

  const result = readAndValidateDiscountForm(formData);
  if (!result.ok) {
    redirect(`/settings/discounts?error=${encodeURIComponent(result.error)}`);
  }

  await prisma.discount.update({ where: { id }, data: result.data });

  revalidatePath("/settings/discounts");
  revalidatePath("/sales");
  redirect(`/settings/discounts?success=${encodeURIComponent(`Discount "${result.data.name}" updated`)}`);
}

export async function toggleDiscountActive(id: number, formData: FormData) {
  const gate = await requireRole("canManageSettings");
  if (!gate.ok) {
    redirect(`/settings/discounts?error=${encodeURIComponent(gate.message)}`);
  }

  const nextActive = formData.get("nextActive") === "true";

  await prisma.discount.update({ where: { id }, data: { active: nextActive } });

  revalidatePath("/settings/discounts");
  revalidatePath("/sales");
  redirect(
    `/settings/discounts?success=${encodeURIComponent(`Discount ${nextActive ? "activated" : "deactivated"}`)}`,
  );
}
