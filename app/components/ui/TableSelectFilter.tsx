"use client";

import Select from "./Select";
import { useListQuery } from "./use-list-query";
import { cn } from "@/lib/cn";

/**
 * Live dropdown filter — sibling to TableFilterInput for the filters that pick from a
 * fixed set (stock status, category, PO status). No debounce: a <select> change is
 * already a settled choice, so it navigates immediately.
 */
export default function TableSelectFilter({
  name,
  label,
  value,
  options,
  allLabel = "All",
  className,
}: {
  /** URL search param this select owns, e.g. "status" or "categoryId". */
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  /** Label for the empty/no-filter option. */
  allLabel?: string;
  className?: string;
}) {
  const { setParams } = useListQuery();
  const selectId = `filter-${name}`;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={selectId} className="text-xs font-medium text-text-muted">
        {label}
      </label>
      <Select
        id={selectId}
        value={value}
        onChange={(e) => setParams({ [name]: e.target.value })}
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
