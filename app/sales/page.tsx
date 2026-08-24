import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getActiveShift } from "@/lib/shift";
import { prisma } from "@/lib/prisma";
import { resolveLineTax } from "@/lib/sales-calc";
import IdleLockGuard from "@/app/components/IdleLockGuard";
import SalesTerminal from "@/app/components/sales/SalesTerminal";
import type { SearchResultItem } from "@/app/api/sales/search/route";

const DEFAULT_LOCATION_ID = 1;
// Same convention as app/api/sales/search/route.ts.
const DEFAULT_TAX_CLASS_ID = 1;

export default async function SalesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // A register can't process a sale without an open shift (see plan's business rules) —
  // send the cashier to open one first, then they can come back to the terminal.
  const shift = await getActiveShift(user.id);
  if (!shift) {
    redirect(`/shift?error=${encodeURIComponent("Open a shift before starting sales")}`);
  }

  const [location, paymentMethods, cartDiscounts, catalogProducts, defaultTaxClass, catalogInventory] = await Promise.all([
    prisma.location.findUnique({
      where: { id: DEFAULT_LOCATION_ID },
      select: {
        id: true,
        name: true,
        currencySymbol: true,
        cashRoundingIncrement: true,
        receiptLogoUrl: true,
        receiptFooterText: true,
      },
    }),
    prisma.paymentMethod.findMany({ where: { isActive: true }, orderBy: { id: "asc" } }),
    // Only CART-scoped discounts are safe to quick-pick here — the Discount model has no
    // relation to Product/Category, so PRODUCT/CATEGORY discounts can't be enforced against
    // specific cart lines (see app/actions/discounts.ts and settings/discounts/page.tsx).
    prisma.discount.findMany({
      where: {
        appliesTo: "CART",
        active: true,
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: new Date() } }] },
          { OR: [{ endDate: null }, { endDate: { gte: new Date() } }] },
        ],
      },
      orderBy: { name: "asc" },
    }),
    // Persistent product grid on the Sales Terminal's left column (see SalesTerminal.tsx /
    // ProductGrid.tsx) — a simple "load active products, filter client-side as the search
    // box is typed" approach, fine given the realistic ~50-product catalog size. Only base
    // product rows (no per-variant cards) — variants are still reachable via the existing
    // search-and-scan flow in ProductSearch.tsx.
    prisma.product.findMany({
      where: { isActive: true },
      include: { taxClass: { select: { ratePercentage: true, isInclusive: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.taxClass.findUnique({ where: { id: DEFAULT_TAX_CLASS_ID } }),
    prisma.inventory.findMany({
      where: { locationId: DEFAULT_LOCATION_ID, variantId: null },
      select: { productId: true, quantityOnHand: true },
    }),
  ]);

  const defaultTax = {
    ratePercentage: defaultTaxClass?.ratePercentage.toNumber() ?? 0,
    isInclusive: defaultTaxClass?.isInclusive ?? false,
  };
  const catalogStockMap = new Map(catalogInventory.map((r) => [r.productId, r.quantityOnHand.toNumber()]));

  const catalog: SearchResultItem[] = catalogProducts.map((p) => {
    const tax = resolveLineTax(
      p.taxClass ? { ratePercentage: p.taxClass.ratePercentage.toNumber(), isInclusive: p.taxClass.isInclusive } : null,
      defaultTax,
    );
    return {
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
      quantityOnHand: catalogStockMap.get(p.id) ?? 0,
      imageUrl: p.imageUrl,
    };
  });

  return (
    <IdleLockGuard>
      <SalesTerminal
        cashierName={user.name}
        locationName={location?.name ?? "Main Store"}
        currencySymbol={location?.currencySymbol ?? "₱"}
        cashRoundingIncrement={location?.cashRoundingIncrement ? location.cashRoundingIncrement.toNumber() : null}
        receiptLogoUrl={location?.receiptLogoUrl ?? null}
        receiptFooterText={location?.receiptFooterText ?? null}
        paymentMethods={paymentMethods.map((pm) => ({ id: pm.id, name: pm.name }))}
        cartDiscounts={cartDiscounts.map((d) => ({
          id: d.id,
          name: d.name,
          type: d.type,
          value: Number(d.value),
        }))}
        catalog={catalog}
      />
    </IdleLockGuard>
  );
}
