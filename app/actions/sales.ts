"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { computeCart } from "@/lib/sales-calc";
import type { TaxableLine } from "@/lib/sales-calc";
import { buildReceiptNumber, placeholderReceiptNumber } from "@/lib/receipt-number";
import { getActiveShift } from "@/lib/shift";

// Single-store v1 — same convention as the rest of the catalog/inventory screens.
const DEFAULT_LOCATION_ID = 1;
const DEFAULT_REGISTER_ID = 1;

export interface CartLineInput {
  productId: number;
  variantId: number | null;
  quantity: number;
  unitPrice: number;
  taxRatePercentage: number;
  taxIsInclusive: boolean;
}

export interface DiscountInput {
  type: "PERCENTAGE" | "FIXED";
  value: number;
}

export interface PaymentInput {
  paymentMethodId: number;
  amount: number;
  tenderedAmount: number | null;
  changeGiven: number | null;
  referenceNumber: string | null;
}

/**
 * No POS-terminal action in this file is gated by a Role permission flag (unlike the
 * back-office actions in app/actions/inventory.ts and app/actions/products.ts). This
 * matches the plan's two-tier access model: back-office settings need
 * canAccessBackOffice etc., but a CASHIER (all flags false in the seed) must still be
 * able to run the sales terminal — that's the whole point of the role. Every action still
 * requires *some* authenticated session (proxy.ts already enforces this for the route,
 * this is defense in depth) and always derives cashierId from the session, never from
 * client input.
 */
/**
 * A register can't process (or even park) a sale without an open shift — the plan's
 * business rule is "all sales/cash movements tie to the active shift." The Sales
 * Terminal page already redirects to /shift when there's no open shift, so in normal
 * use this never throws; it's defense in depth against a stale client still POSTing
 * after the cashier closed their shift in another tab.
 */
async function requireCashier() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Not authenticated");
  }
  const shift = await getActiveShift(user.id);
  if (!shift) {
    throw new Error("No open shift — open a shift before processing sales");
  }
  return { user, shift };
}

function toTaxableLines(lines: CartLineInput[]): TaxableLine[] {
  return lines.map((l) => ({
    key: `${l.productId}_${l.variantId ?? "base"}`,
    productId: l.productId,
    variantId: l.variantId,
    sku: "",
    name: "",
    unitPrice: l.unitPrice,
    quantity: l.quantity,
    taxRatePercentage: l.taxRatePercentage,
    taxIsInclusive: l.taxIsInclusive,
    trackStock: true, // re-checked per-line against the DB in completeSale; irrelevant for hold/void math
  }));
}

/**
 * Hold (park) the current cart, or update an already-parked sale in place if resuming one
 * (existingSaleId set). No stock impact either way — stock only moves on completeSale.
 * Totals are re-derived server-side from the raw line inputs via computeCart, never
 * trusted as client-sent aggregates.
 */
export async function holdSale(input: {
  existingSaleId: number | null;
  lines: CartLineInput[];
  discount: DiscountInput | null;
  customerId?: number | null;
}): Promise<{ id: number }> {
  const { user, shift } = await requireCashier();

  if (input.lines.length === 0) {
    throw new Error("Cannot park an empty cart");
  }

  const computed = computeCart(toTaxableLines(input.lines), input.discount);

  const saleId = await prisma.$transaction(async (tx) => {
    let id: number;

    if (input.existingSaleId) {
      const existing = await tx.sale.findFirst({
        where: { id: input.existingSaleId, status: "PARKED" },
        select: { id: true },
      });
      if (!existing) {
        throw new Error("Parked sale no longer exists — it may have already been completed or voided");
      }
      id = existing.id;
      await tx.saleLineItem.deleteMany({ where: { saleId: id } });
      await tx.sale.update({
        where: { id },
        data: {
          customerId: input.customerId ?? null,
          subtotal: computed.subtotal,
          discountTotal: computed.discountTotal,
          taxTotal: computed.taxTotal,
          grandTotal: computed.grandTotal,
        },
      });
    } else {
      const created = await tx.sale.create({
        data: {
          receiptNumber: placeholderReceiptNumber(),
          locationId: DEFAULT_LOCATION_ID,
          registerId: DEFAULT_REGISTER_ID,
          cashierId: user.id,
          customerId: input.customerId ?? null,
          shiftId: shift.id,
          status: "PARKED",
          subtotal: computed.subtotal,
          discountTotal: computed.discountTotal,
          taxTotal: computed.taxTotal,
          grandTotal: computed.grandTotal,
        },
      });
      id = created.id;
    }

    for (const l of computed.lines) {
      await tx.saleLineItem.create({
        data: {
          saleId: id,
          productId: l.productId,
          variantId: l.variantId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discountAmount: l.discountAmount,
          taxAmount: l.taxAmount,
          lineTotal: l.lineTotal,
        },
      });
    }

    return id;
  });

  revalidatePath("/sales");
  return { id: saleId };
}

/**
 * Void a parked sale that was resumed into the terminal and then discarded before
 * payment. A cart that was never parked needs no backend call at all (nothing was ever
 * persisted) — see SalesTerminal's "New sale" / discard handler. Only PARKED sales can be
 * voided here; a completed sale requires the (future, Phase 6) Returns flow instead.
 */
export async function voidParkedSale(saleId: number): Promise<void> {
  await requireCashier();

  await prisma.sale.updateMany({
    where: { id: saleId, status: "PARKED" },
    data: { status: "VOIDED" },
  });

  revalidatePath("/sales");
}

/**
 * Cancel ("void") a COMPLETED sale outright — distinct from voidParkedSale above (which
 * only ever touches pre-payment PARKED sales) and distinct from the Returns flow
 * (app/actions/returns.ts's completeReturn, which handles partial/line-item refunds with a
 * chosen refund method). This is the "cashier rang up the wrong sale entirely and nothing
 * should have happened" escape hatch — gated tightly behind canVoidAfterCompletion because
 * of what it deliberately does NOT do: it does not create any refund/Payment-reversal
 * record. The schema has no concept of a negative/refund Payment row outside the
 * Return/ReturnLineItem tables, so a straight void has no mechanism to process an actual
 * cash refund — the original Payment rows are left untouched as a historical record of
 * what was collected. That means this action is only appropriate for a
 * same-day/no-money-has-actually-changed-hands-yet correction; it is NOT a substitute for
 * the Returns flow when a customer needs to be refunded. The confirmation UI (see
 * CancelReceiptForm) must make this distinction explicit before the action fires.
 *
 * What it DOES do, matching the ledger+balance discipline used everywhere else
 * (completeSale's stock deduction, completeReturn's restock, adjustStock's manual
 * adjustment): for every SaleLineItem on the sale, write a StockMovement (reason RETURN —
 * the schema has no void-specific reason and adding one is a schema change, out of scope
 * here) with a positive delta equal to the line's quantity, and increment the matching
 * Inventory row to match. Also writes an AuditLog row so the reason typed into the
 * confirmation form isn't lost — Sale itself has no reason column (unlike Return.reason).
 */
export async function voidCompletedSale(formData: FormData) {
  const gate = await requireRole("canVoidAfterCompletion");
  if (!gate.ok) {
    redirect(`/reports/void-refund?error=${encodeURIComponent(gate.message)}`);
  }
  const user = gate.user;

  const saleId = Number(formData.get("saleId"));
  const reason = String(formData.get("reason") ?? "").trim();

  if (!saleId || Number.isNaN(saleId)) {
    redirect(`/reports/void-refund?error=${encodeURIComponent("Missing sale to cancel")}`);
  }
  if (!reason) {
    redirect(
      `/reports/void-refund?error=${encodeURIComponent("A reason is required to cancel a completed receipt")}`,
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: { lineItems: true },
      });
      if (!sale) {
        throw new Error("Sale not found");
      }
      if (sale.status !== "COMPLETED") {
        throw new Error(
          `This sale is ${sale.status.toLowerCase().replace("_", " ")} and cannot be cancelled this way`,
        );
      }

      await tx.sale.update({
        where: { id: saleId },
        data: { status: "VOIDED" },
      });

      for (const li of sale.lineItems) {
        const product = await tx.product.findUnique({
          where: { id: li.productId },
          select: { trackStock: true },
        });
        if (!product?.trackStock) continue;

        await tx.stockMovement.create({
          data: {
            locationId: DEFAULT_LOCATION_ID,
            productId: li.productId,
            variantId: li.variantId,
            quantityDelta: li.quantity,
            reason: "RETURN",
            referenceId: saleId,
            createdById: user.id,
          },
        });

        const existingInventory = await tx.inventory.findFirst({
          where: { locationId: DEFAULT_LOCATION_ID, productId: li.productId, variantId: li.variantId },
          select: { id: true },
        });
        if (existingInventory) {
          await tx.inventory.update({
            where: { id: existingInventory.id },
            data: { quantityOnHand: { increment: li.quantity } },
          });
        } else {
          await tx.inventory.create({
            data: {
              locationId: DEFAULT_LOCATION_ID,
              productId: li.productId,
              variantId: li.variantId,
              quantityOnHand: li.quantity,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "VOID_COMPLETED_SALE",
          entityType: "Sale",
          entityId: saleId,
          beforeValue: { status: sale.status, grandTotal: sale.grandTotal.toNumber() },
          afterValue: { status: "VOIDED", reason },
        },
      });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to cancel this receipt";
    redirect(`/reports/void-refund?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/reports/void-refund");
  revalidatePath("/sales");
  revalidatePath("/inventory");
  revalidatePath("/products");
  redirect(`/reports/void-refund?success=${encodeURIComponent("Receipt cancelled and stock restocked")}`);
}

/**
 * Complete a sale: assigns the real sequential receipt number, records payment(s), and —
 * in the same transaction — writes a StockMovement + updates Inventory.quantityOnHand for
 * every stock-tracked line (same ledger+balance pattern as adjustStock in
 * app/actions/inventory.ts). Stock only ever deducts here, never on cart-add or park.
 *
 * All monetary totals are re-derived from the raw line inputs (computeCart), and payments
 * must sum to exactly that re-derived grandTotal — client-sent aggregate totals are
 * accepted for optimistic UI only and are never written to the DB as-is.
 */
export async function completeSale(input: {
  existingSaleId: number | null;
  lines: CartLineInput[];
  discount: DiscountInput | null;
  payments: PaymentInput[];
  customerId?: number | null;
}): Promise<{ id: number; receiptNumber: string }> {
  const { user, shift } = await requireCashier();

  if (input.lines.length === 0) {
    throw new Error("Cannot complete an empty cart");
  }
  if (input.payments.length === 0) {
    throw new Error("At least one payment is required");
  }

  const computed = computeCart(toTaxableLines(input.lines), input.discount);

  const paymentsTotal = round2(input.payments.reduce((sum, p) => sum + p.amount, 0));
  if (Math.abs(paymentsTotal - computed.grandTotal) > 0.01) {
    throw new Error(
      `Payments (${paymentsTotal.toFixed(2)}) do not match the grand total (${computed.grandTotal.toFixed(2)})`,
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    // "Store Credit" is a seeded PaymentMethod row (see prisma/seed.ts), not a schema
    // field — a store-credit redemption is just a Payment line against it. Look its id up
    // fresh here (never assume it's still active/present) and, if any payment lines use
    // it, validate the total against the customer's *current* DB balance inside this same
    // transaction — never trust a client-sent balance for this check (mirrors the
    // paymentsTotal !== grandTotal fail-closed check above). Sum first, validate, and only
    // then start writing Sale/SaleLineItem/StockMovement/Payment rows below.
    const storeCreditMethod = await tx.paymentMethod.findUnique({
      where: { name: "Store Credit" },
      select: { id: true },
    });
    const storeCreditAmount = storeCreditMethod
      ? round2(
          input.payments
            .filter((p) => p.paymentMethodId === storeCreditMethod.id)
            .reduce((sum, p) => sum + p.amount, 0),
        )
      : 0;

    if (storeCreditAmount > 0) {
      if (!input.customerId) {
        throw new Error("Store credit payments require a customer attached to the sale");
      }
      const customerForCredit = await tx.customer.findUnique({
        where: { id: input.customerId },
        select: { storeCreditBalance: true },
      });
      if (!customerForCredit) {
        throw new Error("Customer not found");
      }
      const availableBalance = customerForCredit.storeCreditBalance.toNumber();
      if (storeCreditAmount > availableBalance + 0.01) {
        throw new Error(
          `Store credit payment (₱${storeCreditAmount.toFixed(2)}) exceeds the customer's available balance (₱${availableBalance.toFixed(2)})`,
        );
      }
    }

    let saleId: number;
    let receiptNumber: string;

    if (input.existingSaleId) {
      const existing = await tx.sale.findFirst({
        where: { id: input.existingSaleId, status: "PARKED" },
        select: { id: true },
      });
      if (!existing) {
        throw new Error("Parked sale no longer exists — it may have already been completed or voided");
      }
      saleId = existing.id;
      receiptNumber = buildReceiptNumber(DEFAULT_LOCATION_ID, DEFAULT_REGISTER_ID, saleId);
      await tx.saleLineItem.deleteMany({ where: { saleId } });
      await tx.sale.update({
        where: { id: saleId },
        data: {
          receiptNumber,
          status: "COMPLETED",
          completedAt: new Date(),
          // Re-stamp shiftId to the shift completing this sale now, in case it was
          // parked under a different (now-closed) shift and resumed under a new one.
          shiftId: shift.id,
          customerId: input.customerId ?? null,
          subtotal: computed.subtotal,
          discountTotal: computed.discountTotal,
          taxTotal: computed.taxTotal,
          grandTotal: computed.grandTotal,
        },
      });
    } else {
      // receiptNumber depends on the auto-increment id, which Prisma only assigns on
      // insert — create with a throwaway placeholder, then immediately overwrite it.
      const created = await tx.sale.create({
        data: {
          receiptNumber: placeholderReceiptNumber(),
          locationId: DEFAULT_LOCATION_ID,
          registerId: DEFAULT_REGISTER_ID,
          cashierId: user.id,
          customerId: input.customerId ?? null,
          shiftId: shift.id,
          status: "COMPLETED",
          completedAt: new Date(),
          subtotal: computed.subtotal,
          discountTotal: computed.discountTotal,
          taxTotal: computed.taxTotal,
          grandTotal: computed.grandTotal,
        },
      });
      saleId = created.id;
      receiptNumber = buildReceiptNumber(DEFAULT_LOCATION_ID, DEFAULT_REGISTER_ID, saleId);
      await tx.sale.update({ where: { id: saleId }, data: { receiptNumber } });
    }

    for (const l of computed.lines) {
      await tx.saleLineItem.create({
        data: {
          saleId,
          productId: l.productId,
          variantId: l.variantId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discountAmount: l.discountAmount,
          taxAmount: l.taxAmount,
          lineTotal: l.lineTotal,
        },
      });

      const product = await tx.product.findUnique({
        where: { id: l.productId },
        select: { trackStock: true },
      });
      if (!product?.trackStock) continue;

      await tx.stockMovement.create({
        data: {
          locationId: DEFAULT_LOCATION_ID,
          productId: l.productId,
          variantId: l.variantId,
          quantityDelta: -l.quantity,
          reason: "SALE",
          referenceId: saleId,
          createdById: user.id,
        },
      });

      const existingInventory = await tx.inventory.findFirst({
        where: { locationId: DEFAULT_LOCATION_ID, productId: l.productId, variantId: l.variantId },
        select: { id: true },
      });
      if (existingInventory) {
        await tx.inventory.update({
          where: { id: existingInventory.id },
          data: { quantityOnHand: { decrement: l.quantity } },
        });
      } else {
        // No inventory row yet for this product/variant at this location — oversell from
        // an implicit zero, landing negative. Same allowance as adjustStock; the
        // inventory page already surfaces negative-stock rows as an alert.
        await tx.inventory.create({
          data: {
            locationId: DEFAULT_LOCATION_ID,
            productId: l.productId,
            variantId: l.variantId,
            quantityOnHand: -l.quantity,
          },
        });
      }
    }

    for (const p of input.payments) {
      await tx.payment.create({
        data: {
          saleId,
          paymentMethodId: p.paymentMethodId,
          amount: p.amount,
          tenderedAmount: p.tenderedAmount,
          changeGiven: p.changeGiven,
          referenceNumber: p.referenceNumber,
        },
      });
    }

    // Loyalty accrual + store-credit redemption, same atomic block as everything else
    // above — never a separate post-hoc update (ledger-integrity discipline, matching
    // stock movements elsewhere in this function).
    //
    // Accrual formula (not specified in the plan — documenting the business rule here
    // since it's the one place it's decided): 1 point per whole ₱10 of grandTotal,
    // rounded down. E.g. a ₱149.50 sale earns floor(149.50 / 10) = 14 points. Tune by
    // changing this one line; no other code depends on the exact rate.
    //
    // Points *redemption* (spending a points balance at checkout) is explicitly out of
    // scope for this pass — see app/actions/sales.ts's module doc / handoff notes. This
    // only ever increments loyaltyPointsBalance; store credit is the only spendable
    // balance for now (validated + decremented above/here).
    if (input.customerId) {
      const pointsEarned = Math.floor(computed.grandTotal / 10);
      if (pointsEarned > 0 || storeCreditAmount > 0) {
        await tx.customer.update({
          where: { id: input.customerId },
          data: {
            ...(pointsEarned > 0 ? { loyaltyPointsBalance: { increment: pointsEarned } } : {}),
            ...(storeCreditAmount > 0 ? { storeCreditBalance: { decrement: storeCreditAmount } } : {}),
          },
        });
      }
    }

    return { id: saleId, receiptNumber };
  });

  revalidatePath("/sales");
  revalidatePath("/inventory");
  revalidatePath("/products");
  return result;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
