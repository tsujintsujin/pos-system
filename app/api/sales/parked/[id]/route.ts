import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import type { TaxableLine } from "@/lib/sales-calc";

export interface ParkedSaleDetail {
  id: number;
  discountTotal: number;
  lines: TaxableLine[];
  customer: { id: number; name: string; storeCreditBalance: number } | null;
}

/**
 * GET /api/sales/parked/[id] — loads a held sale back into cart shape for the terminal.
 *
 * Note on discount reconstruction: Sale only stores the resulting discountTotal (an
 * aggregate dollar amount), not whether the cashier originally picked "percentage" or
 * "fixed" — that UI choice isn't persisted anywhere in the schema. On resume we reload it
 * as a flat/FIXED amount equal to the stored discountTotal, which reproduces the same
 * total; the percentage-vs-fixed toggle just resets to its default. Per-line
 * discount/tax amounts are preserved exactly since those live on SaleLineItem.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/sales/parked/[id]">) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const saleId = Number(id);
  if (Number.isNaN(saleId)) {
    return NextResponse.json({ error: "Invalid sale id" }, { status: 400 });
  }

  const sale = await prisma.sale.findFirst({
    where: { id: saleId, status: "PARKED" },
    include: {
      lineItems: {
        include: {
          product: { select: { sku: true, name: true, trackStock: true } },
          variant: { select: { name: true, sku: true } },
        },
      },
      customer: { select: { id: true, name: true, storeCreditBalance: true } },
    },
  });

  if (!sale) {
    return NextResponse.json({ error: "Parked sale not found" }, { status: 404 });
  }

  const lines: TaxableLine[] = sale.lineItems.map((li) => {
    const quantity = li.quantity.toNumber();
    const unitPrice = li.unitPrice.toNumber();
    const lineDiscount = li.discountAmount.toNumber();
    const lineTax = li.taxAmount.toNumber();
    const lineTotal = li.lineTotal.toNumber();
    const lineSubtotal = unitPrice * quantity;
    const taxableBase = lineSubtotal - lineDiscount;

    // Re-derive the original rate/inclusive flag from the stored amounts (computeCart in
    // lib/sales-calc.ts is the inverse of this) so the resumed cart recomputes to the same
    // figures even if the product's tax settings changed since it was parked.
    // Inclusive: lineTotal == taxableBase (tax stays embedded, not added on top).
    // Exclusive: lineTotal == taxableBase + taxAmount.
    const taxIsInclusive = round(lineTotal) <= round(taxableBase) + 0.005;
    let taxRatePercentage = 0;
    if (taxableBase > 0) {
      taxRatePercentage = taxIsInclusive
        ? round((lineTax / (taxableBase - lineTax || taxableBase)) * 100)
        : round((lineTax / taxableBase) * 100);
    }

    return {
      key: `${li.productId}_${li.variantId ?? "base"}`,
      productId: li.productId,
      variantId: li.variantId,
      sku: li.variant?.sku ?? li.product.sku,
      name: li.variant ? `${li.product.name} — ${li.variant.name}` : li.product.name,
      unitPrice,
      quantity,
      taxRatePercentage,
      taxIsInclusive,
      trackStock: li.product.trackStock,
    };
  });

  const detail: ParkedSaleDetail = {
    id: sale.id,
    discountTotal: sale.discountTotal.toNumber(),
    lines,
    customer: sale.customer
      ? { id: sale.customer.id, name: sale.customer.name, storeCreditBalance: sale.customer.storeCreditBalance.toNumber() }
      : null,
  };

  return NextResponse.json(detail);
}

function round(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
