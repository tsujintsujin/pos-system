import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { resolveLineTax } from "@/lib/sales-calc";

// Single-store v1 — same convention as app/(catalog)/inventory/page.tsx.
const DEFAULT_LOCATION_ID = 1;
const DEFAULT_TAX_CLASS_ID = 1;

export interface SearchResultItem {
  key: string;
  productId: number;
  variantId: number | null;
  sku: string;
  barcode: string | null;
  name: string;
  unitPrice: number;
  taxRatePercentage: number;
  taxIsInclusive: boolean;
  trackStock: boolean;
  quantityOnHand: number;
  /** Product photo — same plain-URL, no-upload convention as Product.imageUrl elsewhere
   *  (see app/(catalog)/products/[id]/page.tsx). Variants reuse their parent product's
   *  photo since ProductVariant has no imageUrl column of its own. */
  imageUrl: string | null;
}

/**
 * GET /api/sales/search?q=...
 * Matches on SKU/barcode/name across both Product and ProductVariant. A keyboard-wedge
 * barcode scanner just types the code fast + Enter, so this same endpoint (hit via the
 * plain search input's Enter handler) covers "scanning" without any special integration.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({ results: [] });
  }

  const defaultTaxClass = await prisma.taxClass.findUnique({ where: { id: DEFAULT_TAX_CLASS_ID } });
  const defaultTax = {
    ratePercentage: defaultTaxClass?.ratePercentage.toNumber() ?? 0,
    isInclusive: defaultTaxClass?.isInclusive ?? false,
  };

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [
        { sku: { contains: q } },
        { barcode: { contains: q } },
        { name: { contains: q } },
      ],
    },
    include: {
      taxClass: { select: { ratePercentage: true, isInclusive: true } },
      variants: true,
    },
    take: 20,
  });

  const inventory = await prisma.inventory.findMany({
    where: { locationId: DEFAULT_LOCATION_ID },
    select: { productId: true, variantId: true, quantityOnHand: true },
  });
  const stockMap = new Map(
    inventory.map((r) => [`${r.productId}_${r.variantId ?? "base"}`, r.quantityOnHand.toNumber()]),
  );

  const results: SearchResultItem[] = [];

  for (const p of products) {
    const tax = resolveLineTax(
      p.taxClass ? { ratePercentage: p.taxClass.ratePercentage.toNumber(), isInclusive: p.taxClass.isInclusive } : null,
      defaultTax,
    );

    // Base product row — only offer it directly if it has no variants, or the search
    // matched the base SKU/barcode/name explicitly. If it has variants, still include the
    // base row (e.g. "Cola 330ml" single piece) alongside each matching variant.
    results.push({
      key: `${p.id}_base`,
      productId: p.id,
      variantId: null,
      sku: p.sku,
      barcode: p.barcode,
      name: p.name,
      unitPrice: p.sellPrice.toNumber(),
      taxRatePercentage: tax.taxRatePercentage,
      taxIsInclusive: tax.taxIsInclusive,
      trackStock: p.trackStock,
      quantityOnHand: stockMap.get(`${p.id}_base`) ?? 0,
      imageUrl: p.imageUrl,
    });

    for (const v of p.variants) {
      const matchesVariant =
        v.sku.toLowerCase().includes(q.toLowerCase()) ||
        (v.barcode ?? "").toLowerCase().includes(q.toLowerCase()) ||
        v.name.toLowerCase().includes(q.toLowerCase()) ||
        p.name.toLowerCase().includes(q.toLowerCase()) ||
        p.sku.toLowerCase().includes(q.toLowerCase());

      if (!matchesVariant) continue;

      results.push({
        key: `${p.id}_${v.id}`,
        productId: p.id,
        variantId: v.id,
        sku: v.sku,
        barcode: v.barcode,
        name: `${p.name} — ${v.name}`,
        unitPrice: (v.priceOverride ?? p.sellPrice).toNumber(),
        taxRatePercentage: tax.taxRatePercentage,
        taxIsInclusive: tax.taxIsInclusive,
        trackStock: p.trackStock,
        quantityOnHand: stockMap.get(`${p.id}_${v.id}`) ?? 0,
        imageUrl: p.imageUrl,
      });
    }
  }

  return NextResponse.json({ results: results.slice(0, 25) });
}
