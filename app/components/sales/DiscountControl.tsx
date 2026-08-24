"use client";

import type { DiscountInput } from "@/lib/sales-calc";
import type { CartDiscountOption } from "@/app/components/sales/SalesTerminal";
import { TagIcon } from "@/app/components/ui/icons";
import { cn } from "@/lib/cn";

/**
 * Ad-hoc cart-level discount, manually entered by the cashier, plus an optional quick-pick
 * of saved CART-scoped Discount rows (managed at /settings/discounts). Selecting a saved
 * discount just fills in the same type/value state as typing it manually — no separate
 * "which discount was used" tracking exists (Sale has no discountId column), so this stays
 * a pure convenience shortcut on top of the existing ad-hoc DiscountInput shape.
 *
 * Only CART-scoped discounts are offered here: the Discount model has no relation to
 * Product/Category, so PRODUCT/CATEGORY discounts can't be safely applied against specific
 * cart lines yet — those are admin-only metadata for now (see settings/discounts/page.tsx).
 */
export default function DiscountControl({
  discount,
  onChange,
  savedDiscounts = [],
}: {
  discount: DiscountInput;
  onChange: (discount: DiscountInput) => void;
  savedDiscounts?: CartDiscountOption[];
}) {
  const type = discount?.type ?? "PERCENTAGE";
  const value = discount?.value ?? 0;

  return (
    <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
      <label className="flex items-center gap-1.5 text-sm font-medium text-text-muted">
        <TagIcon className="h-4 w-4" />
        Discount
      </label>
      {savedDiscounts.length > 0 && (
        <div className="relative">
          <select
            value=""
            onChange={(e) => {
              const picked = savedDiscounts.find((d) => String(d.id) === e.target.value);
              if (picked) onChange({ type: picked.type, value: picked.value });
            }}
            aria-label="Quick-pick a saved discount"
            className={cn(
              "min-h-11 cursor-pointer rounded-md border border-border bg-surface px-2 py-1 text-sm text-text",
              "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            )}
          >
            <option value="" disabled>
              Saved discount…
            </option>
            {savedDiscounts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.type === "PERCENTAGE" ? `${d.value}%` : `₱${d.value}`})
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="relative">
        <select
          value={type}
          onChange={(e) => onChange({ type: e.target.value as "PERCENTAGE" | "FIXED", value })}
          className={cn(
            "min-h-11 cursor-pointer rounded-md border border-border bg-surface px-2 py-1 text-sm text-text",
            "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          )}
        >
          <option value="PERCENTAGE">%</option>
          <option value="FIXED">₱ flat</option>
        </select>
      </div>
      <input
        type="number"
        min={0}
        step="0.01"
        value={value || ""}
        onChange={(e) => {
          const v = Number(e.target.value);
          onChange(v > 0 ? { type, value: v } : null);
        }}
        placeholder="0"
        className={cn(
          "min-h-11 w-24 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text",
          "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        )}
      />
      {discount && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="min-h-11 cursor-pointer px-1 text-xs font-medium text-text-muted transition-colors duration-150 hover:text-danger"
        >
          Clear
        </button>
      )}
    </div>
  );
}
