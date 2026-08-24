"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, getCurrentUser } from "@/lib/auth";

const DEFAULT_LOCATION_ID = 1;

/**
 * Purchase Order status flow implemented here:
 *
 *   DRAFT --(markPurchaseOrderOrdered)--> ORDERED --(receivePurchaseOrderLineItem)--> PARTIAL --(...)--> RECEIVED
 *                                            |                                                     ^
 *                                            +-----------------------------------------------------+
 *                                            (receiving the last remaining unit on any line jumps straight to RECEIVED)
 *
 *   DRAFT or ORDERED --(cancelPurchaseOrder, only if nothing has been received yet)--> CANCELLED
 *
 * - Line items (product/quantityOrdered/unitCost) can only be added/removed while the PO
 *   is still DRAFT or ORDERED and, for removal, only if nothing on that line has been
 *   received yet — once a receipt has posted a StockMovement against a line it must stay
 *   for the audit trail.
 * - Receiving (receivePurchaseOrderLineItem) is only allowed once the PO has left DRAFT —
 *   i.e. status ORDERED or PARTIAL — mirroring a real "PO submitted to supplier" step
 *   before goods can arrive against it.
 */

// ---------- Purchase order header ----------

export async function createPurchaseOrder(formData: FormData) {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    redirect(`/purchase-orders?error=${encodeURIComponent(gate.message)}`);
  }

  const supplierId = Number(formData.get("supplierId"));
  const locationIdRaw = String(formData.get("locationId") ?? "").trim();
  const locationId = locationIdRaw ? Number(locationIdRaw) : DEFAULT_LOCATION_ID;
  const expectedDateRaw = String(formData.get("expectedDate") ?? "").trim();

  if (!supplierId || Number.isNaN(supplierId)) {
    redirect(`/purchase-orders/new?error=${encodeURIComponent("Select a supplier")}`);
  }
  if (Number.isNaN(locationId)) {
    redirect(`/purchase-orders/new?error=${encodeURIComponent("Invalid location")}`);
  }

  const created = await prisma.purchaseOrder.create({
    data: {
      supplierId,
      locationId,
      status: "DRAFT",
      expectedDate: expectedDateRaw ? new Date(expectedDateRaw) : null,
    },
  });

  revalidatePath("/purchase-orders");
  redirect(`/purchase-orders/${created.id}?success=${encodeURIComponent("Purchase order created — add line items below")}`);
}

export async function markPurchaseOrderOrdered(poId: number) {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    redirect(`/purchase-orders/${poId}?error=${encodeURIComponent(gate.message)}`);
  }

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: { lineItems: { select: { id: true } } },
  });
  if (!po) {
    redirect(`/purchase-orders?error=${encodeURIComponent("Purchase order not found")}`);
  }
  if (po.status !== "DRAFT") {
    redirect(`/purchase-orders/${poId}?error=${encodeURIComponent("Only a draft purchase order can be marked as ordered")}`);
  }
  if (po.lineItems.length === 0) {
    redirect(`/purchase-orders/${poId}?error=${encodeURIComponent("Add at least one line item before ordering")}`);
  }

  await prisma.purchaseOrder.update({ where: { id: poId }, data: { status: "ORDERED" } });

  revalidatePath(`/purchase-orders/${poId}`);
  revalidatePath("/purchase-orders");
  redirect(`/purchase-orders/${poId}?success=${encodeURIComponent("Purchase order marked as ordered")}`);
}

export async function cancelPurchaseOrder(poId: number) {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    redirect(`/purchase-orders/${poId}?error=${encodeURIComponent(gate.message)}`);
  }

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: { lineItems: { select: { quantityReceived: true } } },
  });
  if (!po) {
    redirect(`/purchase-orders?error=${encodeURIComponent("Purchase order not found")}`);
  }
  if (po.status !== "DRAFT" && po.status !== "ORDERED") {
    redirect(`/purchase-orders/${poId}?error=${encodeURIComponent("This purchase order can no longer be cancelled")}`);
  }
  const anyReceived = po.lineItems.some((l) => l.quantityReceived.toNumber() > 0);
  if (anyReceived) {
    redirect(
      `/purchase-orders/${poId}?error=${encodeURIComponent("Cannot cancel a purchase order that already has stock received against it")}`,
    );
  }

  await prisma.purchaseOrder.update({ where: { id: poId }, data: { status: "CANCELLED" } });

  revalidatePath(`/purchase-orders/${poId}`);
  revalidatePath("/purchase-orders");
  redirect(`/purchase-orders/${poId}?success=${encodeURIComponent("Purchase order cancelled")}`);
}

// ---------- Line items ----------

export async function addPurchaseOrderLineItem(poId: number, formData: FormData) {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    redirect(`/purchase-orders/${poId}?error=${encodeURIComponent(gate.message)}`);
  }

  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId }, select: { status: true } });
  if (!po) {
    redirect(`/purchase-orders?error=${encodeURIComponent("Purchase order not found")}`);
  }
  if (po.status !== "DRAFT" && po.status !== "ORDERED") {
    redirect(`/purchase-orders/${poId}?error=${encodeURIComponent("Cannot add line items to this purchase order anymore")}`);
  }

  const productId = Number(formData.get("productId"));
  const quantityOrderedRaw = String(formData.get("quantityOrdered") ?? "").trim();
  const unitCostRaw = String(formData.get("unitCost") ?? "").trim();

  if (!productId || Number.isNaN(productId)) {
    redirect(`/purchase-orders/${poId}?error=${encodeURIComponent("Select a product")}`);
  }
  if (!quantityOrderedRaw || Number.isNaN(Number(quantityOrderedRaw)) || Number(quantityOrderedRaw) <= 0) {
    redirect(`/purchase-orders/${poId}?error=${encodeURIComponent("Quantity ordered must be greater than 0")}`);
  }
  if (!unitCostRaw || Number.isNaN(Number(unitCostRaw)) || Number(unitCostRaw) < 0) {
    redirect(`/purchase-orders/${poId}?error=${encodeURIComponent("Unit cost must be a non-negative number")}`);
  }

  await prisma.purchaseOrderLineItem.create({
    data: {
      purchaseOrderId: poId,
      productId,
      quantityOrdered: quantityOrderedRaw,
      unitCost: unitCostRaw,
    },
  });

  revalidatePath(`/purchase-orders/${poId}`);
  redirect(`/purchase-orders/${poId}?success=${encodeURIComponent("Line item added")}`);
}

export async function removePurchaseOrderLineItem(poId: number, lineItemId: number) {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    redirect(`/purchase-orders/${poId}?error=${encodeURIComponent(gate.message)}`);
  }

  const line = await prisma.purchaseOrderLineItem.findUnique({
    where: { id: lineItemId },
    select: { quantityReceived: true, purchaseOrder: { select: { status: true } } },
  });
  if (!line) {
    redirect(`/purchase-orders/${poId}?error=${encodeURIComponent("Line item not found")}`);
  }
  if (line.quantityReceived.toNumber() > 0) {
    redirect(`/purchase-orders/${poId}?error=${encodeURIComponent("Cannot remove a line item that has already received stock")}`);
  }
  if (line.purchaseOrder.status !== "DRAFT" && line.purchaseOrder.status !== "ORDERED") {
    redirect(`/purchase-orders/${poId}?error=${encodeURIComponent("Cannot modify line items on this purchase order anymore")}`);
  }

  await prisma.purchaseOrderLineItem.delete({ where: { id: lineItemId } });

  revalidatePath(`/purchase-orders/${poId}`);
  redirect(`/purchase-orders/${poId}?success=${encodeURIComponent("Line item removed")}`);
}

// ---------- Receiving ----------

/**
 * Receives (fully or partially) one line item of an ORDERED/PARTIAL purchase order.
 * Reuses the exact ledger+balance transaction discipline from adjustStock
 * (app/actions/inventory.ts) and completeSale (app/actions/sales.ts):
 *   1. Increment PurchaseOrderLineItem.quantityReceived by the quantity received now.
 *   2. Create a StockMovement (reason RECEIVING, positive delta = quantity received now,
 *      referenceId = the PurchaseOrder's id).
 *   3. Update-or-create the Inventory row for that product at the PO's location.
 *   4. Recompute the PO's overall status: RECEIVED if every line is fully received,
 *      PARTIAL if some (but not all) stock has landed, otherwise left unchanged.
 * All four steps run inside a single prisma.$transaction so the ledger, the balance, and
 * the PO status can never drift apart from each other.
 */
export async function receivePurchaseOrderLineItem(poId: number, lineItemId: number, formData: FormData) {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    redirect(`/purchase-orders/${poId}?error=${encodeURIComponent(gate.message)}`);
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/purchase-orders/${poId}?error=${encodeURIComponent("Not authenticated")}`);
  }

  const quantityRaw = String(formData.get("quantity") ?? "").trim();
  const quantity = Number(quantityRaw);
  if (!quantityRaw || Number.isNaN(quantity) || quantity <= 0) {
    redirect(`/purchase-orders/${poId}?error=${encodeURIComponent("Quantity received must be a positive number")}`);
  }

  try {
    await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUnique({
        where: { id: poId },
        include: { lineItems: true },
      });
      if (!po) {
        throw new Error("Purchase order not found");
      }
      if (po.status !== "ORDERED" && po.status !== "PARTIAL") {
        throw new Error("Purchase order must be marked as ordered before receiving stock");
      }

      const line = po.lineItems.find((l) => l.id === lineItemId);
      if (!line) {
        throw new Error("Line item not found on this purchase order");
      }

      const ordered = line.quantityOrdered.toNumber();
      const alreadyReceived = line.quantityReceived.toNumber();
      const remaining = ordered - alreadyReceived;
      if (quantity > remaining + 0.0005) {
        throw new Error(`Cannot receive more than the ${remaining} unit(s) remaining on this line`);
      }

      await tx.purchaseOrderLineItem.update({
        where: { id: lineItemId },
        data: { quantityReceived: { increment: quantityRaw } },
      });

      const product = await tx.product.findUnique({
        where: { id: line.productId },
        select: { trackStock: true },
      });

      if (product?.trackStock) {
        await tx.stockMovement.create({
          data: {
            locationId: po.locationId,
            productId: line.productId,
            variantId: null,
            quantityDelta: quantityRaw,
            reason: "RECEIVING",
            referenceId: po.id,
            createdById: user.id,
          },
        });

        const existingInventory = await tx.inventory.findFirst({
          where: { locationId: po.locationId, productId: line.productId, variantId: null },
          select: { id: true },
        });
        if (existingInventory) {
          await tx.inventory.update({
            where: { id: existingInventory.id },
            data: { quantityOnHand: { increment: quantityRaw } },
          });
        } else {
          await tx.inventory.create({
            data: {
              locationId: po.locationId,
              productId: line.productId,
              variantId: null,
              quantityOnHand: quantityRaw,
            },
          });
        }
      }

      const freshLines = await tx.purchaseOrderLineItem.findMany({ where: { purchaseOrderId: poId } });
      const allReceived = freshLines.every((l) => l.quantityReceived.toNumber() >= l.quantityOrdered.toNumber() - 0.0005);
      const anyReceived = freshLines.some((l) => l.quantityReceived.toNumber() > 0);
      const newStatus = allReceived ? "RECEIVED" : anyReceived ? "PARTIAL" : po.status;
      if (newStatus !== po.status) {
        await tx.purchaseOrder.update({ where: { id: poId }, data: { status: newStatus } });
      }
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not receive stock";
    redirect(`/purchase-orders/${poId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/purchase-orders/${poId}`);
  revalidatePath("/purchase-orders");
  revalidatePath("/inventory");
  revalidatePath("/products");
  redirect(`/purchase-orders/${poId}?success=${encodeURIComponent("Stock received")}`);
}
