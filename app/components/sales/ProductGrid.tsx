"use client";

import { useMemo } from "react";
import type { SearchResultItem } from "@/app/api/sales/search/route";
import Badge from "@/app/components/ui/Badge";
import EmptyState from "@/app/components/ui/EmptyState";
import { BoxIcon } from "@/app/components/ui/icons";
import { cn } from "@/lib/cn";

/**
 * Persistent, always-visible catalog grid — the reference layout's main tap-to-add surface,
 * replacing the old "type to see a dropdown of results" pattern. `products` is the full
 * active catalog fetched once server-side (app/sales/page.tsx); filtering by `query` is a
 * cheap client-side string match given the realistic ~50-product catalog size. This is
 * purely a display/filter layer — tapping a card calls the exact same `onAdd` handler
 * (SalesTerminal's `addItem`) that ProductSearch's dropdown used to call.
 */
export default function ProductGrid({
  products,
  query,
  currencySymbol,
  onAdd,
}: {
  products: SearchResultItem[];
  query: string;
  currencySymbol: string;
  onAdd: (item: SearchResultItem) => void;
}) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q),
    );
  }, [products, query]);

  if (filtered.length === 0) {
    return (
      <EmptyState
        icon={<BoxIcon className="h-8 w-8 text-text-muted" />}
        message="No matching products"
        subMessage="Try a different search term."
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {filtered.map((p) => {
        const outOfStock = p.trackStock && p.quantityOnHand <= 0;
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => onAdd(p)}
            aria-label={`Add ${p.name} to cart${outOfStock ? " (out of stock)" : ""}`}
            className={cn(
              "group flex min-h-44 cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-surface text-left shadow-sm",
              "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              outOfStock && "opacity-60",
            )}
          >
            <div className="relative aspect-square w-full shrink-0 overflow-hidden bg-bg">
              {p.imageUrl ? (
                // Arbitrary external URLs, no next.config.ts remotePatterns configured — same
                // plain-<img> convention as Product.imageUrl elsewhere in this app (see
                // app/(catalog)/products/[id]/page.tsx and Receipt.tsx).
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.imageUrl}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <BoxIcon className="h-8 w-8 text-text-muted" />
                </div>
              )}
              {outOfStock && (
                <Badge variant="danger" className="absolute left-2 top-2 shadow-sm">
                  Out of stock
                </Badge>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1 px-3 py-2.5">
              <span className="line-clamp-2 text-sm font-medium leading-snug text-text">{p.name}</span>
              <span className="mt-auto text-sm font-semibold text-text-muted">
                {currencySymbol}
                {p.unitPrice.toFixed(2)}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
