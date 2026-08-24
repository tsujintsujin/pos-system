import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Thin wrapper standardizing borders/padding/hover-row styling across the
 * many <table> elements in reports/lists. Deliberately unopinionated about
 * data shape — callers still map their own rows/cells.
 */
export function Table({ className, children, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border">
      <table className={cn("w-full border-collapse text-sm", className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHead({ className, children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cn("bg-bg", className)} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({ className, children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn("divide-y divide-border", className)} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({ className, children, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn("transition-colors duration-150 hover:bg-bg", className)} {...props}>
      {children}
    </tr>
  );
}

export function TableHeaderCell({
  className,
  children,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "border-b border-border px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-muted",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function TableCell({
  className,
  children,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  // No default text color here (deliberately) — the body already sets `text-text`
  // globally (see app/globals.css), and baking it into this base class would fight
  // any caller-supplied color override (e.g. `text-danger`/`text-success` for
  // variance cells) since `cn()` is a plain class-join, not a Tailwind class merger:
  // both classes end up in the DOM and whichever wins CSS cascade order applies,
  // which is not necessarily the caller's override. Let it inherit instead.
  return (
    <td className={cn("px-3 py-2.5", className)} {...props}>
      {children}
    </td>
  );
}
