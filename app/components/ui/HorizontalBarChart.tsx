import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Ranked horizontal bars — sibling to BarChart.tsx (which is for a time axis). Used where
 * the category labels are long product names and the question is "which are the worst /
 * biggest", e.g. items below their reorder point, or stock value sitting unsold.
 *
 * Laid out with flexbox rather than SVG: the labels are links to product pages, and real
 * anchors in normal flow keep that accessible and truncatable without SVG text metrics.
 */
export interface HorizontalBarDatum {
  key: string;
  /** Often a <ProductLink> rather than a bare string. */
  label: ReactNode;
  value: number;
  /** Right-hand figure. Defaults to the raw value. */
  valueLabel?: string;
  /** Palette token; defaults to the primary hue. */
  color?: string;
  /** Extra context under the bar, e.g. "reorder at 20". */
  subLabel?: string;
}

export default function HorizontalBarChart({
  data,
  className,
  emptyMessage = "Nothing to show for this period.",
}: {
  data: HorizontalBarDatum[];
  className?: string;
  emptyMessage?: string;
}) {
  if (data.length === 0) {
    return <p className={cn("py-6 text-center text-sm text-text-muted", className)}>{emptyMessage}</p>;
  }

  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1);

  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {data.map((d) => (
        <li key={d.key} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 flex-1 truncate">{d.label}</span>
            <span className="shrink-0 font-medium text-text">{d.valueLabel ?? d.value}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-bg">
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{
                width: `${Math.max(2, (Math.abs(d.value) / max) * 100)}%`,
                backgroundColor: d.color ?? "var(--color-primary)",
              }}
            />
          </div>
          {d.subLabel && <span className="text-xs text-text-muted">{d.subLabel}</span>}
        </li>
      ))}
    </ul>
  );
}
