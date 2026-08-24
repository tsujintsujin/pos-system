import Link from "next/link";
import { cn } from "@/lib/cn";

export type DashboardRangeKey = "today" | "week" | "month";

const OPTIONS: { key: DashboardRangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
];

/**
 * Quick-select date-range control for the dashboard header (Today / This week / This
 * month) — a lighter-weight sibling of ReportDateFilter's full from/to form, since the
 * dashboard only needs a few common presets rather than an arbitrary custom range.
 * Plain links (no JS) — selecting a preset navigates to /dashboard?range=<key>.
 */
export default function DashboardDateFilter({ active }: { active: DashboardRangeKey }) {
  return (
    <div
      role="group"
      aria-label="Date range"
      className="inline-flex items-center gap-1 rounded-md border border-border bg-surface p-1"
    >
      {OPTIONS.map((opt) => {
        const isActive = opt.key === active;
        return (
          <Link
            key={opt.key}
            href={`/dashboard?range=${opt.key}`}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "inline-flex min-h-9 cursor-pointer items-center rounded px-3 text-sm font-medium transition-colors duration-150",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              isActive
                ? "bg-primary text-white"
                : "text-text-muted hover:bg-bg hover:text-text",
            )}
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}
