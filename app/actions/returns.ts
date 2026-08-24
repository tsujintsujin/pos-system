"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getActiveShift, DEFAULT_LOCATION_ID } from "@/lib/shift";
import { findApprovingManager } from "@/lib/manager-approval";
import { MANAGER_APPROVAL_THRESHOLD } from "@/lib/return-constants";
import type { RefundMethod } from "@/app/generated/prisma/enums";

// See lib/return-constants.ts for why MANAGER_APPROVAL_THRESHOLD lives outside this
// "use server" file. ₱500 is a judgment call (roughly "more than an average single-item
// purchase" for a general retail store), not specified numerically in the plan — easy to
// tune later since it's just a code constant, not persisted config. If the cashier's own
// role already has canApproveRefund, they self-approve — no second PIN entry needed below.

export interface ReturnLineInput {
  saleLineItemId: number;
  quantityReturned: number;
  restocked: boolean;
}

export interface CompleteReturnInput {
  saleId: number;
  reason: string;
  refundMethod: RefundMethod;
  lines: ReturnLineInput[];
  /**
   * Raw PIN typed into the manager-approval modal, only present when the computed refund
   * exceeds MANAGER_APPROVAL_THRESHOLD and the acting cashier's own role lacks
   * canApproveRefund. Re-verified here server-side regardless of whether the client's
   * "verify-manager-pin" pre-check already succeeded — never trust a client-sent approved
   * flag for something this consequential.
   */
  managerPin: string | null;
}

/**
 * Complete a return/refund in one transaction, matching the ledger+balance discipline of
 * completeSale (app/actions/sales.ts):
 *  - Return + ReturnLineItem rows recorded first.
 *  - For each restocked line: a StockMovement (reason RETURN, positive delta) + the
 *    matching Inventory increment, same pattern as completeSale's stock deduction, inverted.
 *  - Sale.status flips to REFUNDED once every line item's cumulative returned quantity
 *    (across all Returns, not just this one) reaches its original quantity; otherwise
 *    PARTIALLY_REFUNDED.
 *  - STORE_CREDIT refunds increment Customer.storeCreditBalance (only possible when the
 *    original sale has a customer attached — see STORE_CREDIT gate below).
 *
 * KNOWN GAP (flagged per instructions, not fixed by adding a schema field unilaterally):
 * `Return` has no `shiftId` column, so a refund's cash-out cannot be linked to a specific
 * shift the way a Sale's cash-in is. We still gate CASH refunds on an open shift existing
 * (parity with "all cash movements tie to the active shift"), but we cannot persist which
 * shift absorbed it, so shift X/Z-reports (lib/shift.ts) will NOT reflect refund cash-outs.
 * Report this to the user as a potential future migration (`Return.shiftId Int?`).
 */
export async function completeReturn(input: CompleteReturnInput): Promise<{ id: number }> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Not authenticated");
  }

  const selectedLines = input.lines.filter((l) => l.quantityReturned > 0);
  if (selectedLines.length === 0) {
    throw new Error("Select at least one line item to return");
  }

  const sale = await prisma.sale.findUnique({
    where: { id: input.saleId },
    include: {
      customer: { select: { id: true } },
      lineItems: { include: { returnLineItems: { select: { quantityReturned: true } } } },
    },
  });
  if (!sale) {
    throw new Error("Original sale not found");
  }
  if (sale.status !== "COMPLETED" && sale.status !== "PARTIALLY_REFUNDED") {
    throw new Error(`This sale is ${sale.status.toLowerCase().replace("_", " ")} and cannot be returned`);
  }

  const lineById = new Map(sale.lineItems.map((li) => [li.id, li]));

  // Validate every requested line against the original sale + what's already been returned.
  let totalRefunded = 0;
  for (const req of selectedLines) {
    const original = lineById.get(req.saleLineItemId);
    if (!original) {
      throw new Error(`Line item ${req.saleLineItemId} does not belong to this sale`);
    }
    const alreadyReturned = original.returnLineItems.reduce((sum, r) => sum + r.quantityReturned.toNumber(), 0);
    const quantity = original.quantity.toNumber();
    const returnable = round2(quantity - alreadyReturned);
    if (req.quantityReturned > returnable + 1e-9) {
      throw new Error(`Cannot return ${req.quantityReturned} of "${req.saleLineItemId}" — only ${returnable} left returnable`);
    }
    const lineTotal = original.lineTotal.toNumber();
    const refundForLine = quantity > 0 ? round2((lineTotal / quantity) * req.quantityReturned) : 0;
    totalRefunded = round2(totalRefunded + refundForLine);
  }

  if (totalRefunded <= 0) {
    throw new Error("Refund amount must be greater than zero");
  }

  if (input.refundMethod === "STORE_CREDIT" && !sale.customer) {
    throw new Error("Store credit requires a customer on the original sale, but this sale has none attached");
  }

  if (input.refundMethod === "CASH") {
    const activeShift = await getActiveShift(user.id);
    if (!activeShift) {
      throw new Error("No open shift — open a shift before processing a cash refund");
    }
  }

  // Manager-PIN gate: self-approve if the acting cashier's own role already has
  // canApproveRefund, otherwise require + re-verify a manager PIN server-side.
  if (totalRefunded > MANAGER_APPROVAL_THRESHOLD && !user.role.canApproveRefund) {
    if (!input.managerPin) {
      throw new Error(
        `Refunds over ₱${MANAGER_APPROVAL_THRESHOLD.toFixed(2)} require manager approval — enter a manager PIN`,
      );
    }
    const manager = await findApprovingManager(input.managerPin);
    if (!manager) {
      throw new Error("Invalid manager PIN, or that PIN does not belong to a user who can approve refunds");
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.return.create({
      data: {
        originalSaleId: sale.id,
        processedById: user.id,
        reason: input.reason.trim() || null,
        refundMethod: input.refundMethod,
        totalRefunded,
      },
    });

    for (const req of selectedLines) {
      const original = lineById.get(req.saleLineItemId)!;

      await tx.returnLineItem.create({
        data: {
          returnId: created.id,
          saleLineItemId: req.saleLineItemId,
          quantityReturned: req.quantityReturned,
          restocked: req.restocked,
        },
      });

      if (!req.restocked) continue;

      await tx.stockMovement.create({
        data: {
          locationId: DEFAULT_LOCATION_ID,
          productId: original.productId,
          variantId: original.variantId,
          quantityDelta: req.quantityReturned,
          reason: "RETURN",
          referenceId: created.id,
          createdById: user.id,
        },
      });

      const existingInventory = await tx.inventory.findFirst({
        where: { locationId: DEFAULT_LOCATION_ID, productId: original.productId, variantId: original.variantId },
        select: { id: true },
      });
      if (existingInventory) {
        await tx.inventory.update({
          where: { id: existingInventory.id },
          data: { quantityOnHand: { increment: req.quantityReturned } },
        });
      } else {
        await tx.inventory.create({
          data: {
            locationId: DEFAULT_LOCATION_ID,
            productId: original.productId,
            variantId: original.variantId,
            quantityOnHand: req.quantityReturned,
          },
        });
      }
    }

    // Determine whether every line on the sale is now fully returned (cumulative, across
    // all Returns including this one) to decide REFUNDED vs PARTIALLY_REFUNDED.
    const returnedThisRound = new Map(selectedLines.map((l) => [l.saleLineItemId, l.quantityReturned]));
    const fullyReturned = sale.lineItems.every((li) => {
      const priorReturned = li.returnLineItems.reduce((sum, r) => sum + r.quantityReturned.toNumber(), 0);
      const thisRound = returnedThisRound.get(li.id) ?? 0;
      return round2(priorReturned + thisRound) >= round2(li.quantity.toNumber());
    });

    await tx.sale.update({
      where: { id: sale.id },
      data: { status: fullyReturned ? "REFUNDED" : "PARTIALLY_REFUNDED" },
    });

    if (input.refundMethod === "STORE_CREDIT" && sale.customer) {
      await tx.customer.update({
        where: { id: sale.customer.id },
        data: { storeCreditBalance: { increment: totalRefunded } },
      });
    }

    return { id: created.id };
  });

  revalidatePath("/returns");
  revalidatePath("/sales");
  revalidatePath("/inventory");
  revalidatePath("/products");
  return result;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
