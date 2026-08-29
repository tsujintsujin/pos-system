"use client";

import { useCallback, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Shared URL-writing hook behind the list controls (TableFilterInput, TableSelectFilter,
 * SortableHeaderCell, TablePagination). Kept in one place so all four agree on the two
 * rules that matter:
 *
 *  - an empty value REMOVES its param rather than leaving `?q=` in the URL, and
 *  - changing any filter or sort resets `page` (staying on page 7 of a result set that
 *    just shrank to two pages shows an empty table).
 *
 * `router.replace` (not push) so typing in a filter doesn't stack up history entries,
 * and `scroll: false` so the page doesn't jump to the top on every keystroke.
 */
export function useListQuery() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const setParams = useCallback(
    (updates: Record<string, string | null>, options?: { resetPage?: boolean }) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      if (options?.resetPage !== false) next.delete("page");

      const query = next.toString();
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  return { searchParams, setParams, pending };
}
