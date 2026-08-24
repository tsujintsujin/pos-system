"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, getCurrentUser } from "@/lib/auth";
import type { StockMovementReason } from "@/app/generated/prisma/enums";

/** Reason codes valid for a manual stock adjustment (subset of StockMovementReason —
 * SALE/RETURN/RECEIVING/TRANSFER are written by other flows, not this screen). */
const MANUAL_ADJUSTMENT_REASONS: StockMovementReason[] = [
  "ADJUSTMENT",
  "DAMAGE",
  "THEFT",
  "EXPIRY",
  "COUNT_CORRECTION",
];

/**
 * Manual stock adjustment: writes a StockMovement ledger row and updates (or creates)
 * the matching Inventory balance in a single transaction, so the ledger and the balance
 * can never drift apart. Reused pattern for sales/returns/PO receiving in later phases.
 */
export async function adjustStock(formData: FormData) {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    redirect(`/inventory?error=${encodeURIComponent(gate.message)}`);
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/inventory?error=${encodeURIComponent("Not authenticated")}`);
  }

  const locationId = Number(formData.get("locationId"));
  const productId = Number(formData.get("productId"));
  const variantIdRaw = String(formData.get("variantId") ?? "").trim();
  const variantId = variantIdRaw ? Number(variantIdRaw) : null;
  const deltaRaw = String(formData.get("delta") ?? "").trim();
  const reason = String(formData.get("reason") ?? "") as StockMovementReason;

  if (!locationId || !productId || Number.isNaN(locationId) || Number.isNaN(productId)) {
    redirect(`/inventory?error=${encodeURIComponent("Missing product/location for adjustment")}`);
  }
  if (variantId !== null && Number.isNaN(variantId)) {
    redirect(`/inventory?error=${encodeURIComponent("Invalid variant")}`);
  }

  const delta = Number(deltaRaw);
  if (!deltaRaw || Number.isNaN(delta) || delta === 0) {
    redirect(`/inventory?error=${encodeURIComponent("Adjustment quantity must be a non-zero number")}`);
  }

  if (!MANUAL_ADJUSTMENT_REASONS.includes(reason)) {
    redirect(`/inventory?error=${encodeURIComponent("Select a valid reason code")}`);
  }

  // Interactive transaction: Prisma's generated compound-unique input for
  // [locationId, productId, variantId] requires variantId to be non-null (a known
  // limitation with nullable columns in compound uniques), so a plain upsert() can't
  // be used when variantId is null (base-unit stock). Look the row up manually inside
  // the transaction instead — still atomic with the ledger write below.
  await prisma.$transaction(async (tx) => {
    await tx.stockMovement.create({
      data: {
        locationId,
        productId,
        variantId,
        quantityDelta: deltaRaw,
        reason,
        referenceId: null,
        createdById: user.id,
      },
    });

    const existing = await tx.inventory.findFirst({
      where: { locationId, productId, variantId },
      select: { id: true },
    });

    if (existing) {
      await tx.inventory.update({
        where: { id: existing.id },
        data: { quantityOnHand: { increment: deltaRaw } },
      });
    } else {
      await tx.inventory.create({
        data: { locationId, productId, variantId, quantityOnHand: deltaRaw },
      });
    }
  });

  revalidatePath("/inventory");
  revalidatePath("/products");
  redirect(`/inventory?success=${encodeURIComponent("Stock adjusted")}`);
}
