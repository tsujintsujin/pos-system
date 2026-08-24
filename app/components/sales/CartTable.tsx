"use client";

import type { ComputedLine } from "@/lib/sales-calc";
import EmptyState from "@/app/components/ui/EmptyState";
import { BoxIcon, CartIcon, MinusIcon, PlusIcon, XIcon } from "@/app/components/ui/icons";
import { cn } from "@/lib/cn";

const stepButtonClasses = cn(
  "flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-text-muted",
  "transition-colors duration-150 hover:bg-surface hover:text-primary",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
  "active:bg-primary/10",
);

export default function CartTable({
  lines,
  currencySymbol,
  imageByKey = {},
  onQuantityChange,
  onStepQuantity,
  onRemove,
}: {
  lines: ComputedLine[];
  currencySymbol: string;
  /** key -> product photo, threaded separately from lib/sales-calc.ts's line shape (which
   *  stays untouched) purely so the reference layout's row thumbnails have something to
   *  show — see SalesTerminal.tsx's addItem for where this map is populated. */
  imageByKey?: Record<string, string | null>;
  onQuantityChange: (key: string, quantity: number) => void;
  onStepQuantity: (key: string, delta: number) => void;
  onRemove: (key: string) => void;
}) {
  if (lines.length === 0) {
    return (
      <EmptyState
        icon={<CartIcon className="h-8 w-8 text-text-muted" />}
        message="Cart is empty"
        subMessage="Tap a product to get started."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {lines.map((l) => {
        const imageUrl = imageByKey[l.key];
        // Reference pattern: show the pre-discount price struck through above the
        // post-discount/tax price whenever a cart-level discount landed on this line.
        const hasDiscount = l.discountAmount > 0;
        return (
          <li
            key={l.key}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface p-2.5 shadow-sm"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-bg">
              {imageUrl ? (
                // Same plain-<img>, no-remotePatterns convention as ProductGrid.tsx / the
                // catalog product edit page.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <BoxIcon className="h-6 w-6 text-text-muted" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-text">{l.name}</div>
              <div className="truncate text-xs text-text-muted">
                {l.sku}
                {hasDiscount && <span className="ml-1 text-success">· discount applied</span>}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1 rounded-full bg-bg px-1 py-1">
              <button
                type="button"
                onClick={() => onStepQuantity(l.key, -1)}
                className={stepButtonClasses}
                aria-label={`Decrease quantity of ${l.name}`}
              >
                <MinusIcon className="h-4 w-4" />
              </button>
              <input
                type="number"
                min={0.001}
                step="0.001"
                value={l.quantity}
                onChange={(e) => onQuantityChange(l.key, Number(e.target.value))}
                className={cn(
                  "min-h-8 w-12 bg-transparent text-center text-sm font-medium text-text",
                  "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                )}
                aria-label={`Quantity of ${l.name}`}
              />
              <button
                type="button"
                onClick={() => onStepQuantity(l.key, 1)}
                className={stepButtonClasses}
                aria-label={`Increase quantity of ${l.name}`}
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="flex w-20 shrink-0 flex-col items-end">
              {hasDiscount && (
                <span className="text-xs text-text-muted line-through">
                  {currencySymbol}
                  {l.lineSubtotal.toFixed(2)}
                </span>
              )}
              <span className="text-sm font-semibold text-text">
                {currencySymbol}
                {l.lineTotal.toFixed(2)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => onRemove(l.key)}
              aria-label={`Remove ${l.name} from cart`}
              className={cn(
                "flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-danger-border text-danger",
                "transition-colors duration-150 hover:bg-danger-bg",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger",
              )}
            >
              <XIcon className="h-4 w-4" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
