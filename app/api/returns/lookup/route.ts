import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export interface ReturnableLine {
  saleLineItemId: number;
  productId: number;
  variantId: number | null;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  alreadyReturned: number;
  returnable: number;
}

export interface SaleLookupResult {
  id: number;
  receiptNumber: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  cashierName: string;
  customerId: number | null;
  customerName: string | null;
  grandTotal: number;
  paymentMethods: string[];
  lines: ReturnableLine[];
}

/**
 * GET /api/returns/lookup?receiptNumber=... — look up a completed sale for the Returns
 * terminal. Only COMPLETED / PARTIALLY_REFUNDED sales are returnable (a fully REFUNDED,
 * VOIDED, or still-PARKED sale is rejected with a clear message). Each line item's
 * `returnable` quantity is its original quantity minus the sum of `quantityReturned`
 * already recorded against it across any prior Return — never trust a client-side running
 * total, since another return could complete concurrently between lookups.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const receiptNumber = request.nextUrl.searchParams.get("receiptNumber")?.trim();
  if (!receiptNumber) {
    return NextResponse.json({ error: "receiptNumber is required" }, { status: 400 });
  }

  const sale = await prisma.sale.findUnique({
    where: { receiptNumber },
    include: {
      cashier: { select: { name: true } },
      customer: { select: { id: true, name: true } },
      payments: { include: { paymentMethod: { select: { name: true } } } },
      lineItems: {
        include: {
          product: { select: { name: true, sku: true } },
          variant: { select: { name: true, sku: true } },
          returnLineItems: { select: { quantityReturned: true } },
        },
      },
    },
  });

  if (!sale) {
    return NextResponse.json({ error: "No sale found with that receipt number" }, { status: 404 });
  }

  if (sale.status !== "COMPLETED" && sale.status !== "PARTIALLY_REFUNDED") {
    return NextResponse.json(
      { error: `This sale is ${sale.status.toLowerCase().replace("_", " ")} and cannot be returned` },
      { status: 400 },
    );
  }

  const lines: ReturnableLine[] = sale.lineItems.map((li) => {
    const alreadyReturned = li.returnLineItems.reduce((sum, r) => sum + r.quantityReturned.toNumber(), 0);
    const quantity = li.quantity.toNumber();
    return {
      saleLineItemId: li.id,
      productId: li.productId,
      variantId: li.variantId,
      name: li.variant ? `${li.product.name} — ${li.variant.name}` : li.product.name,
      sku: li.variant?.sku ?? li.product.sku,
      quantity,
      unitPrice: li.unitPrice.toNumber(),
      lineTotal: li.lineTotal.toNumber(),
      alreadyReturned,
      returnable: Math.max(0, round2(quantity - alreadyReturned)),
    };
  });

  const result: SaleLookupResult = {
    id: sale.id,
    receiptNumber: sale.receiptNumber,
    status: sale.status,
    createdAt: sale.createdAt.toISOString(),
    completedAt: sale.completedAt?.toISOString() ?? null,
    cashierName: sale.cashier.name,
    customerId: sale.customer?.id ?? null,
    customerName: sale.customer?.name ?? null,
    grandTotal: sale.grandTotal.toNumber(),
    paymentMethods: [...new Set(sale.payments.map((p) => p.paymentMethod.name))],
    lines,
  };

  return NextResponse.json(result);
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
