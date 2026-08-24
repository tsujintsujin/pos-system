import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export interface ReceiptData {
  id: number;
  receiptNumber: string;
  createdAt: string;
  completedAt: string | null;
  cashierName: string;
  locationName: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  lines: {
    name: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  payments: {
    methodName: string;
    amount: number;
    tenderedAmount: number | null;
    changeGiven: number | null;
  }[];
}

/** GET /api/sales/[id]/receipt — full detail for the on-screen/print receipt view. */
export async function GET(_request: Request, ctx: RouteContext<"/api/sales/[id]/receipt">) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const saleId = Number(id);
  if (Number.isNaN(saleId)) {
    return NextResponse.json({ error: "Invalid sale id" }, { status: 400 });
  }

  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      cashier: { select: { name: true } },
      location: { select: { name: true } },
      lineItems: {
        include: {
          product: { select: { name: true, sku: true } },
          variant: { select: { name: true, sku: true } },
        },
      },
      payments: { include: { paymentMethod: { select: { name: true } } } },
    },
  });

  if (!sale) {
    return NextResponse.json({ error: "Sale not found" }, { status: 404 });
  }

  const data: ReceiptData = {
    id: sale.id,
    receiptNumber: sale.receiptNumber,
    createdAt: sale.createdAt.toISOString(),
    completedAt: sale.completedAt?.toISOString() ?? null,
    cashierName: sale.cashier.name,
    locationName: sale.location.name,
    subtotal: sale.subtotal.toNumber(),
    discountTotal: sale.discountTotal.toNumber(),
    taxTotal: sale.taxTotal.toNumber(),
    grandTotal: sale.grandTotal.toNumber(),
    lines: sale.lineItems.map((li) => ({
      name: li.variant ? `${li.product.name} — ${li.variant.name}` : li.product.name,
      sku: li.variant?.sku ?? li.product.sku,
      quantity: li.quantity.toNumber(),
      unitPrice: li.unitPrice.toNumber(),
      lineTotal: li.lineTotal.toNumber(),
    })),
    payments: sale.payments.map((p) => ({
      methodName: p.paymentMethod.name,
      amount: p.amount.toNumber(),
      tenderedAmount: p.tenderedAmount?.toNumber() ?? null,
      changeGiven: p.changeGiven?.toNumber() ?? null,
    })),
  };

  return NextResponse.json(data);
}
