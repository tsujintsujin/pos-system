"use client";

import { useEffect, useRef } from "react";
import Select from "./Select";
import { ChevronLeftIcon } from "./icons";
import { useListQuery } from "./use-list-query";
import { cn } from "@/lib/cn";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE, pageCount } from "@/lib/list-params";

/**
 * Pager + page-size picker for a server-paginated list. The page size is remembered per
 * table in localStorage (`storageKey`) and re-applied to the URL on load, so a user who
 * prefers 100 rows keeps getting 100 rows on that table across visits — while the URL
 * stays the single source of truth the server component actually queries from.
 */
export default function TablePagination({
  storageKey,
  page,
  pageSize,
  total,
  className,
}: {
  /** Distinct per table, e.g. "products" — page size is remembered under this key. */
  storageKey: string;
  page: number;
  pageSize: number;
  total: number;
  className?: string;
}) {
  const { searchParams, setParams } = useListQuery();
  const restored = useRef(false);
  const lastPages = pageCount(total, pageSize);
  const urlSize = searchParams.get("size");

  // Re-apply the remembered page size once per mount, and only when the URL isn't
  // already carrying one (an explicit ?size= in a shared link wins).
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (urlSize) return;
    try {
      const saved = window.localStorage.getItem(`pos.pageSize.${storageKey}`);
      const parsed = Number(saved);
      if (
        saved &&
        (PAGE_SIZE_OPTIONS as readonly number[]).includes(parsed) &&
        parsed !== DEFAULT_PAGE_SIZE
      ) {
        setParams({ size: saved });
      }
    } catch {
      // Storage unavailable — the default page size still applies.
    }
  }, [storageKey, urlSize, setParams]);

  function changeSize(next: string) {
    try {
      window.localStorage.setItem(`pos.pageSize.${storageKey}`, next);
    } catch {
      // Non-fatal: the URL still carries the choice for this visit.
    }
    setParams({ size: next });
  }

  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 text-sm text-text-muted",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <label htmlFor={`page-size-${storageKey}`} className="text-xs font-medium">
          Rows per page
        </label>
        <Select
          id={`page-size-${storageKey}`}
          value={String(pageSize)}
          onChange={(e) => changeSize(e.target.value)}
          className="min-h-9 w-24 py-1 text-xs"
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs">
          {first}–{last} of {total}
        </span>
        <div className="flex items-center gap-1">
          <PagerButton
            label="Previous page"
            disabled={page <= 1}
            onClick={() => setParams({ page: String(page - 1) }, { resetPage: false })}
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </PagerButton>
          <span className="px-1 text-xs font-medium text-text">
            {page} / {lastPages}
          </span>
          <PagerButton
            label="Next page"
            disabled={page >= lastPages}
            onClick={() => setParams({ page: String(page + 1) }, { resetPage: false })}
          >
            <ChevronLeftIcon className="h-4 w-4 rotate-180" />
          </PagerButton>
        </div>
      </div>
    </div>
  );
}

function PagerButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-border bg-surface text-text-muted transition-colors duration-150 hover:bg-bg hover:text-text disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      {children}
    </button>
  );
}
