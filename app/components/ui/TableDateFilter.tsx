"use client";

import Input from "./Input";
import { useListQuery } from "./use-list-query";
import { cn } from "@/lib/cn";

/**
 * Live date-range filter — sibling to TableFilterInput for `<input type="date">`.
 * No debounce: a date picker only emits a change once a complete date is chosen, so
 * each change is already a settled value. Clearing the field removes the bound.
 *
 * Distinct from ReportDateFilter, which is a no-JS GET form with an Apply button used by
 * the report pages; this one navigates as soon as a date is picked, matching the rest of
 * the list controls.
 */
export default function TableDateFilter({
  fromName = "from",
  toName = "to",
  fromValue,
  toValue,
  label = "Date range",
  className,
}: {
  fromName?: string;
  toName?: string;
  fromValue: string;
  toValue: string;
  label?: string;
  className?: string;
}) {
  const { setParams } = useListQuery();

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs font-medium text-text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <Input
          type="date"
          aria-label={`${label} from`}
          value={fromValue}
          max={toValue || undefined}
          onChange={(e) => setParams({ [fromName]: e.target.value })}
          className="w-40"
        />
        <span className="text-sm text-text-muted">to</span>
        <Input
          type="date"
          aria-label={`${label} to`}
          value={toValue}
          min={fromValue || undefined}
          onChange={(e) => setParams({ [toName]: e.target.value })}
          className="w-40"
        />
      </div>
    </div>
  );
}
