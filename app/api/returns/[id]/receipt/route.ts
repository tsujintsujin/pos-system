import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export interface ReturnReceiptData {
  id: number;
  createdAt: string;
  reason: string | null;
  refundMethod: string;
  totalRefunded: number;
  processedByName: string;
  originalReceiptNumber: string;
  originalSaleId: number;
  lines: {
    productId: number;
    name: string;
    sku: string;
    quantityReturned: number;
    restocked: boolean;
    refundAmount: number;
  }[];
}

/** GET /api/returns/[id]/receipt — confirmation view for a completed return, mirrors app/api/sales/[id]/receipt. */
export async function GET(_request: Request, ctx: RouteContext<"/api/returns/[id]/receipt">) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const returnId = Number(id);
  if (Number.isNaN(returnId)) {
    return NextResponse.json({ error: "Invalid return id" }, { status: 400 });
  }

  const ret = await prisma.return.findUnique({
    where: { id: returnId },
    include: {
      processedBy: { select: { name: true } },
      originalSale: { select: { id: true, receiptNumber: true } },
      lineItems: {
        include: {
          saleLineItem: {
            include: {
              product: { select: { name: true, sku: true } },
              variant: { select: { name: true, sku: true } },
            },
          },
        },
      },
    },
  });

  if (!ret) {
    return NextResponse.json({ error: "Return not found" }, { status: 404 });
  }

  const data: ReturnReceiptData = {
    id: ret.id,
    createdAt: ret.createdAt.toISOString(),
    reason: ret.reason,
    refundMethod: ret.refundMethod,
    totalRefunded: ret.totalRefunded.toNumber(),
    processedByName: ret.processedBy.name,
    originalReceiptNumber: ret.originalSale.receiptNumber,
    originalSaleId: ret.originalSale.id,
    lines: ret.lineItems.map((li) => {
      const sli = li.saleLineItem;
      const quantity = sli.quantity.toNumber();
      const lineTotal = sli.lineTotal.toNumber();
      const quantityReturned = li.quantityReturned.toNumber();
      const refundAmount = quantity > 0 ? round2((lineTotal / quantity) * quantityReturned) : 0;
      return {
        productId: sli.productId,
        name: sli.variant ? `${sli.product.name} — ${sli.variant.name}` : sli.product.name,
        sku: sli.variant?.sku ?? sli.product.sku,
        quantityReturned,
        restocked: li.restocked,
        refundAmount,
      };
    }),
  };

  return NextResponse.json(data);
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
