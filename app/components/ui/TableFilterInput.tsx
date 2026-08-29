"use client";

import { useEffect, useRef, useState } from "react";
import Input from "./Input";
import { SearchIcon, SpinnerIcon } from "./icons";
import { useListQuery } from "./use-list-query";
import { cn } from "@/lib/cn";

const DEBOUNCE_MS = 250;

/**
 * Live text filter — results update as you type, no "Search" button. Each keystroke
 * restarts a 250ms timer; only the settled value is written to the URL, which is what
 * re-runs the server component's Prisma query (partial + case-insensitive, see
 * lib/list-params.ts `containsInsensitive`).
 */
export default function TableFilterInput({
  name,
  label,
  placeholder,
  defaultValue = "",
  className,
  showIcon = true,
}: {
  /** URL search param this input owns, e.g. "q" or "sku". */
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  className?: string;
  showIcon?: boolean;
}) {
  const { setParams, pending } = useListQuery();
  const [value, setValue] = useState(defaultValue);
  // The last value this input itself pushed into the URL, and the last incoming
  // `defaultValue` we reconciled against. Together they let us tell our own echo apart
  // from a genuinely external change.
  const [pushed, setPushed] = useState(defaultValue);
  const [reconciled, setReconciled] = useState(defaultValue);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Skip the debounce write that would otherwise fire from the mount effect and
  // rewrite the URL to what it already says.
  const mounted = useRef(false);

  // Adjusting state during render (React's documented alternative to a sync effect).
  // The URL can change from outside this input — a "Clear" link, browser Back — and the
  // box should follow it. But it must NOT follow the echo of its own debounced push:
  // that round-trip lands a few hundred ms later, and adopting it would overwrite
  // whatever the user typed in the meantime.
  if (defaultValue !== reconciled) {
    setReconciled(defaultValue);
    if (defaultValue !== pushed) setValue(defaultValue);
  }

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    timer.current = setTimeout(() => {
      const next = value.trim();
      setPushed(next);
      setParams({ [name]: next });
    }, DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // setParams is recreated whenever the URL changes; depending on it here would
    // re-arm the timer on every navigation, so intentionally key off the value only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, name]);

  const inputId = `filter-${name}`;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={inputId} className="text-xs font-medium text-text-muted">
        {label}
      </label>
      <div className="relative">
        {showIcon && (
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        )}
        <Input
          id={inputId}
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className={cn(showIcon && "pl-9", "pr-9")}
        />
        {pending && (
          <SpinnerIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-text-muted" />
        )}
      </div>
    </div>
  );
}
