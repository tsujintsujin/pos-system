"use client";

import { useEffect, useRef, useState } from "react";
import type { SearchResultItem } from "@/app/api/sales/search/route";
import { BarcodeIcon, SearchIcon } from "@/app/components/ui/icons";
import { cn } from "@/lib/cn";
import { apiPath } from "@/lib/base-path";

/**
 * Debounced product/SKU/barcode search box. A real keyboard-wedge barcode scanner just
 * types the code fast and then sends Enter — Enter with exactly one result on screen (or
 * an exact SKU/barcode match) adds that item straight to the cart and clears the box, so
 * no special scanner integration is needed.
 *
 * The dropdown-of-results UI has been replaced by the persistent ProductGrid below it
 * (SalesTerminal.tsx) — `onQueryChange` mirrors every keystroke up so the grid can filter
 * itself live, while this component's own debounced fetch keeps resolving exact SKU/
 * barcode matches for the Enter-to-scan flow exactly as before.
 */
export default function ProductSearch({
  onAdd,
  onQueryChange,
}: {
  onAdd: (item: SearchResultItem) => void;
  onQueryChange?: (query: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();

    // Both branches' state updates are deferred into the setTimeout callback (rather than
    // the empty-query case setState-ing directly at the top of the effect) so nothing
    // commits synchronously during the effect's own invocation.
    debounceRef.current = setTimeout(async () => {
      if (!trimmed) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(apiPath(`/api/sales/search?q=${encodeURIComponent(trimmed)}`));
        const data = await res.json();
        setResults(data.results ?? []);
      } finally {
        setLoading(false);
      }
    }, trimmed ? 250 : 0);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function pick(item: SearchResultItem) {
    onAdd(item);
    setQuery("");
    onQueryChange?.("");
    setResults([]);
    inputRef.current?.focus();
  }

  function handleChange(value: string) {
    setQuery(value);
    onQueryChange?.(value);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();

    const trimmed = query.trim();
    if (!trimmed) return;

    // Prefer an exact SKU/barcode match (scanner case); otherwise fall back to the first
    // result if there's exactly one, so Enter is unambiguous.
    const exact = results.find(
      (r) => r.sku.toLowerCase() === trimmed.toLowerCase() || (r.barcode ?? "").toLowerCase() === trimmed.toLowerCase(),
    );
    if (exact) {
      pick(exact);
    } else if (results.length === 1) {
      pick(results[0]);
    }
  }

  return (
    <div className="relative">
      <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Scan barcode or search products…"
        autoFocus
        className={cn(
          "min-h-14 w-full rounded-full border border-border bg-surface pl-12 pr-14 py-3 text-base text-text shadow-sm",
          "placeholder:text-text-muted",
          "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          "transition-colors duration-200",
        )}
      />
      {loading ? (
        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xs text-text-muted">…</span>
      ) : (
        // Purely a visual affordance signalling "this box accepts scanner input" per the
        // reference layout — a keyboard-wedge scanner already works by typing + Enter
        // (handleKeyDown above) with zero extra integration, so this button just focuses
        // the input rather than opening any new scanning UI.
        <button
          type="button"
          onClick={() => inputRef.current?.focus()}
          aria-label="Focus search to scan a barcode"
          className={cn(
            "absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-text-muted",
            "transition-colors duration-150 hover:bg-bg hover:text-primary",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          )}
        >
          <BarcodeIcon className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
