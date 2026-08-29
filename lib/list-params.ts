/**
 * Server-side parsing for the shared list controls (app/components/ui/TableFilterInput,
 * TableSelectFilter, SortableHeaderCell, TablePagination). Those client components only
 * write URL search params; every page reads them back through here and turns them into
 * Prisma `where`/`orderBy`/`skip`/`take`, so filtering, sorting and paging always happen
 * in the database rather than in the browser.
 */

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

export type SortDirection = "asc" | "desc";

/** Clamp `?size=` to one of the offered options. */
export function parsePageSize(value: string | undefined): number {
  const n = Number(value);
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
}

/** 1-based page number; anything unparseable or below 1 falls back to page 1. */
export function parsePage(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/**
 * Resolve `?sort=`/`?dir=` against the columns a page actually allows sorting by.
 * An unknown column name falls back to the page's default ordering rather than
 * being passed through to Prisma (which would throw on an invalid field).
 */
export function parseSort<K extends string>(
  sort: string | undefined,
  dir: string | undefined,
  allowed: readonly K[],
  fallback: { key: K; dir: SortDirection },
): { key: K; dir: SortDirection } {
  if (!sort || !(allowed as readonly string[]).includes(sort)) return fallback;
  return { key: sort as K, dir: dir === "desc" ? "desc" : "asc" };
}

/** `skip`/`take` for a 1-based page number. */
export function paginate(page: number, pageSize: number): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

/**
 * Partial, case-insensitive match. Every list filter must use this, never an equality
 * check: on Postgres a bare `{ contains }` is case-SENSITIVE, so typing "an" would match
 * "Banana" but miss "Andrea". `mode: "insensitive"` is what makes both match.
 */
export function containsInsensitive(value: string) {
  return { contains: value, mode: "insensitive" as const };
}

/** Total page count for `total` rows, never below 1 (an empty list is still "page 1 of 1"). */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/**
 * Clamp a requested page to the range that actually exists. Guards the case where a
 * filter narrows the result set while the user is on a high page number — without this
 * they'd land on an empty table with no obvious way back.
 */
export function clampPage(page: number, total: number, pageSize: number): number {
  return Math.min(page, pageCount(total, pageSize));
}
