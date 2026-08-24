/**
 * Pure cart math shared between the client-side Sales Terminal (for live totals as the
 * cashier builds the cart) and the completeSale/holdSale server actions (which re-derive
 * these same numbers from the submitted line items rather than trusting client-sent
 * aggregate totals — see app/actions/sales.ts).
 *
 * Tax model:
 * - Each line carries its own resolved tax rate + inclusive/exclusive flag (product's
 *   TaxClass, falling back to the store default — see resolveLineTax below).
 * - A single ad-hoc cart-level discount (percentage or fixed) is distributed across lines
 *   proportional to each line's share of the pre-discount subtotal, so tax is computed on
 *   the post-discount taxable base per line (correct even when lines have different rates).
 * - Exclusive-tax lines add their tax on top of the price; inclusive-tax lines have the
 *   tax already embedded in unitPrice, so it is only "backed out" for the taxAmount/
 *   taxTotal display and is NOT added again to grandTotal.
 */

export type DiscountInput = { type: "PERCENTAGE" | "FIXED"; value: number } | null;

export interface TaxableLine {
  key: string;
  productId: number;
  variantId: number | null;
  sku: string;
  name: string;
  unitPrice: number;
  quantity: number;
  taxRatePercentage: number;
  taxIsInclusive: boolean;
  trackStock: boolean;
}

export interface ComputedLine extends TaxableLine {
  lineSubtotal: number;
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
}

export interface ComputedCart {
  lines: ComputedLine[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
}

/** Round to 2 decimal places (cents), guarding against float artifacts like 19.999999999998. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Round to the nearest multiple of `increment` (e.g. nearest ₱1, nearest ₱0.25) — the
 * physical-cash equivalent of the sale's exact grand total. Falls back to plain round2
 * ("no rounding") when increment is null/0/undefined, matching Location.cashRoundingIncrement's
 * documented "null/0 = no rounding" convention. This is display/tendering math only — it must
 * never be applied to computeCart's own totals (subtotal/discountTotal/taxTotal/grandTotal),
 * which stay exact for the ledger.
 */
export function roundToCashIncrement(amount: number, increment: number | null | undefined): number {
  if (!increment || increment <= 0) return round2(amount);
  return round2(Math.round(amount / increment) * increment);
}

export function computeCart(lines: TaxableLine[], discount: DiscountInput): ComputedCart {
  const rawSubtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const subtotal = round2(rawSubtotal);

  let discountTotal = 0;
  if (discount && discount.value > 0 && subtotal > 0) {
    const raw = discount.type === "PERCENTAGE" ? subtotal * (discount.value / 100) : discount.value;
    discountTotal = Math.max(0, Math.min(raw, subtotal));
  }
  discountTotal = round2(discountTotal);

  const computedLines: ComputedLine[] = [];
  let taxTotal = 0;
  let grandTotal = subtotal - discountTotal;

  for (const l of lines) {
    const lineSubtotal = l.unitPrice * l.quantity;
    const share = rawSubtotal > 0 ? lineSubtotal / rawSubtotal : 0;
    const lineDiscount = round2(discountTotal * share);
    const taxableBase = lineSubtotal - lineDiscount;
    const rate = l.taxRatePercentage / 100;

    let taxAmount: number;
    let lineTotal: number;
    if (l.taxIsInclusive) {
      taxAmount = round2(taxableBase - taxableBase / (1 + rate));
      lineTotal = round2(taxableBase);
    } else {
      taxAmount = round2(taxableBase * rate);
      lineTotal = round2(taxableBase + taxAmount);
      grandTotal += taxAmount;
    }

    taxTotal += taxAmount;
    computedLines.push({
      ...l,
      lineSubtotal: round2(lineSubtotal),
      discountAmount: lineDiscount,
      taxAmount,
      lineTotal,
    });
  }

  return {
    lines: computedLines,
    subtotal,
    discountTotal,
    taxTotal: round2(taxTotal),
    grandTotal: round2(grandTotal),
  };
}

/** Resolve the tax rate/inclusive flag to use for a product: its own TaxClass if set, else the store default. */
export function resolveLineTax(
  productTax: { ratePercentage: number; isInclusive: boolean } | null | undefined,
  defaultTax: { ratePercentage: number; isInclusive: boolean },
) {
  return {
    taxRatePercentage: productTax?.ratePercentage ?? defaultTax.ratePercentage,
    taxIsInclusive: productTax?.isInclusive ?? defaultTax.isInclusive,
  };
}
