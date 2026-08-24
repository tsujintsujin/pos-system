"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

const DEFAULT_LOCATION_ID = 1;

/**
 * All settings mutations redirect back to their settings page with ?error=/?success=
 * query params — same pattern as every other back-office CRUD screen in this app.
 * Gated with canManageSettings specifically (not the broader canAccessBackOffice),
 * per the Role model's dedicated settings flag.
 */

// ---------- Store profile (Location.name / Location.address, plus currencySymbol /
// cashRoundingIncrement / receiptLogoUrl / receiptFooterText — see settings/page.tsx for
// what's still missing beyond these: multi-language, per-register overrides, etc.) ----------

export async function updateStoreProfile(formData: FormData) {
  const gate = await requireRole("canManageSettings");
  if (!gate.ok) {
    redirect(`/settings/store-profile?error=${encodeURIComponent(gate.message)}`);
  }

  const name = String(formData.get("name") ?? "").trim();
  const addressRaw = String(formData.get("address") ?? "").trim();
  const currencySymbolRaw = String(formData.get("currencySymbol") ?? "").trim();
  const cashRoundingIncrementRaw = String(formData.get("cashRoundingIncrement") ?? "").trim();
  const receiptLogoUrlRaw = String(formData.get("receiptLogoUrl") ?? "").trim();
  const receiptFooterTextRaw = String(formData.get("receiptFooterText") ?? "").trim();

  if (!name) {
    redirect(`/settings/store-profile?error=${encodeURIComponent("Store name is required")}`);
  }

  const currencySymbol = currencySymbolRaw || "₱";
  if (currencySymbol.length > 3) {
    redirect(`/settings/store-profile?error=${encodeURIComponent("Currency symbol must be 3 characters or fewer")}`);
  }

  // Blank/0 means "no rounding" — stored as null, matching the schema's documented
  // no-op convention rather than persisting a meaningless 0.00 Decimal.
  let cashRoundingIncrement: string | null = null;
  if (cashRoundingIncrementRaw) {
    const parsed = Number(cashRoundingIncrementRaw);
    if (Number.isNaN(parsed) || parsed < 0) {
      redirect(
        `/settings/store-profile?error=${encodeURIComponent("Cash rounding increment must be a non-negative number")}`,
      );
    }
    cashRoundingIncrement = parsed > 0 ? cashRoundingIncrementRaw : null;
  }

  await prisma.location.update({
    where: { id: DEFAULT_LOCATION_ID },
    data: {
      name,
      address: addressRaw || null,
      currencySymbol,
      cashRoundingIncrement,
      receiptLogoUrl: receiptLogoUrlRaw || null,
      receiptFooterText: receiptFooterTextRaw || null,
    },
  });

  revalidatePath("/settings/store-profile");
  revalidatePath("/dashboard");
  revalidatePath("/sales");
  redirect(`/settings/store-profile?success=${encodeURIComponent("Store profile updated")}`);
}

// ---------- Tax classes ----------

export async function createTaxClass(formData: FormData) {
  const gate = await requireRole("canManageSettings");
  if (!gate.ok) {
    redirect(`/settings/tax-classes?error=${encodeURIComponent(gate.message)}`);
  }

  const name = String(formData.get("name") ?? "").trim();
  const rateRaw = String(formData.get("ratePercentage") ?? "").trim();
  const isInclusive = formData.get("isInclusive") === "on";

  if (!name) {
    redirect(`/settings/tax-classes?error=${encodeURIComponent("Tax class name is required")}`);
  }

  const rate = Number(rateRaw);
  if (!rateRaw || Number.isNaN(rate) || rate < 0) {
    redirect(`/settings/tax-classes?error=${encodeURIComponent("Rate must be a non-negative number")}`);
  }

  await prisma.taxClass.create({ data: { name, ratePercentage: rateRaw, isInclusive } });

  revalidatePath("/settings/tax-classes");
  revalidatePath("/products");
  redirect(`/settings/tax-classes?success=${encodeURIComponent(`Tax class "${name}" created`)}`);
}

export async function updateTaxClass(id: number, formData: FormData) {
  const gate = await requireRole("canManageSettings");
  if (!gate.ok) {
    redirect(`/settings/tax-classes?error=${encodeURIComponent(gate.message)}`);
  }

  const name = String(formData.get("name") ?? "").trim();
  const rateRaw = String(formData.get("ratePercentage") ?? "").trim();
  const isInclusive = formData.get("isInclusive") === "on";

  if (!name) {
    redirect(`/settings/tax-classes?error=${encodeURIComponent("Tax class name is required")}`);
  }

  const rate = Number(rateRaw);
  if (!rateRaw || Number.isNaN(rate) || rate < 0) {
    redirect(`/settings/tax-classes?error=${encodeURIComponent("Rate must be a non-negative number")}`);
  }

  await prisma.taxClass.update({
    where: { id },
    data: { name, ratePercentage: rateRaw, isInclusive },
  });

  revalidatePath("/settings/tax-classes");
  revalidatePath("/products");
  redirect(`/settings/tax-classes?success=${encodeURIComponent(`Tax class "${name}" updated`)}`);
}

// ---------- Payment methods ----------
// No delete — a used PaymentMethod can never be safely hard-deleted without breaking
// historical Payment rows. Only an isActive toggle is exposed, matching the product
// soft-deactivate precedent (Product.isActive) rather than the reason-code delete-guard
// pattern used for categories/suppliers.

export async function togglePaymentMethodActive(id: number, formData: FormData) {
  const gate = await requireRole("canManageSettings");
  if (!gate.ok) {
    redirect(`/settings/payment-methods?error=${encodeURIComponent(gate.message)}`);
  }

  const nextActive = formData.get("nextActive") === "true";

  await prisma.paymentMethod.update({ where: { id }, data: { isActive: nextActive } });

  revalidatePath("/settings/payment-methods");
  redirect(
    `/settings/payment-methods?success=${encodeURIComponent(`Payment method ${nextActive ? "activated" : "deactivated"}`)}`,
  );
}
