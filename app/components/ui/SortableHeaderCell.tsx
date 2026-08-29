"use client";

import { TableHeaderCell } from "./Table";
import { ChevronDownIcon } from "./icons";
import { useListQuery } from "./use-list-query";
import { cn } from "@/lib/cn";

/**
 * Sortable column header. Clicking cycles asc -> desc -> none (back to the page's own
 * default ordering), writing `?sort=<column>&dir=<asc|desc>`; the server component reads
 * those back via lib/list-params.ts `parseSort` and hands them to Prisma's `orderBy`, so
 * the sort happens across the whole table, not just the visible page.
 */
export default function SortableHeaderCell({
  column,
  children,
  activeColumn,
  activeDirection,
  align = "left",
  className,
}: {
  /** Column key written to `?sort=`. Must be in the page's allow-list. */
  column: string;
  children: React.ReactNode;
  activeColumn: string | null;
  activeDirection: "asc" | "desc" | null;
  align?: "left" | "right";
  className?: string;
}) {
  const { setParams } = useListQuery();
  const active = activeColumn === column;
  const direction = active ? activeDirection : null;

  function cycle() {
    if (!active) setParams({ sort: column, dir: "asc" });
    else if (direction === "asc") setParams({ sort: column, dir: "desc" });
    else setParams({ sort: null, dir: null });
  }

  return (
    <TableHeaderCell
      aria-sort={active ? (direction === "desc" ? "descending" : "ascending") : "none"}
      className={cn(align === "right" && "text-right", className)}
    >
      <button
        type="button"
        onClick={cycle}
        title={
          !active ? "Sort ascending" : direction === "asc" ? "Sort descending" : "Clear sort"
        }
        className={cn(
          "inline-flex cursor-pointer items-center gap-1 rounded text-xs font-semibold uppercase tracking-wide transition-colors duration-150",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          align === "right" && "flex-row-reverse",
          active ? "text-primary" : "text-text-muted hover:text-text",
        )}
      >
        {children}
        <ChevronDownIcon
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-transform duration-150",
            direction === "asc" && "rotate-180",
            !active && "opacity-30",
          )}
        />
      </button>
    </TableHeaderCell>
  );
}
