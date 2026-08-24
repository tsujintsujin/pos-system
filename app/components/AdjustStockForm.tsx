"use client";

import { useState } from "react";
import { adjustStock } from "@/app/actions/inventory";
import Input from "@/app/components/ui/Input";
import Select from "@/app/components/ui/Select";
import Button from "@/app/components/ui/Button";

const REASONS = [
  { value: "ADJUSTMENT", label: "Adjustment" },
  { value: "DAMAGE", label: "Damage" },
  { value: "THEFT", label: "Theft" },
  { value: "EXPIRY", label: "Expiry" },
  { value: "COUNT_CORRECTION", label: "Count correction" },
] as const;

export default function AdjustStockForm({
  locationId,
  productId,
  variantId,
  label,
}: {
  locationId: number;
  productId: number;
  variantId: number | null;
  label: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Adjust
      </Button>
    );
  }

  return (
    <form
      action={adjustStock}
      className="flex flex-wrap items-center justify-end gap-2 rounded-md border border-border bg-bg p-2"
    >
      <input type="hidden" name="locationId" value={locationId} />
      <input type="hidden" name="productId" value={productId} />
      {variantId !== null && <input type="hidden" name="variantId" value={variantId} />}
      <span className="sr-only">{label}</span>
      <Input
        type="number"
        name="delta"
        step="0.001"
        required
        placeholder="+/- qty"
        className="w-24 min-h-9 py-1 text-xs"
      />
      <Select name="reason" required className="w-36 min-h-9 py-1 text-xs">
        <option value="">Reason…</option>
        {REASONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </Select>
      <Button type="submit" size="sm">
        Save
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </form>
  );
}
