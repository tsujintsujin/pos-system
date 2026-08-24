import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import Card from "./Card";
import Sparkline from "./Sparkline";

export type DashboardStatTone = "primary" | "success" | "warning" | "info" | "danger";

const badgeToneClasses: Record<DashboardStatTone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  info: "bg-info-bg text-info",
  danger: "bg-danger-bg text-danger",
};

export interface DashboardStatCardProps {
  label: string;
  value: ReactNode;
  icon: (props: { className?: string }) => ReactNode;
  tone?: DashboardStatTone;
  /** Chronological trend series (e.g. last 7 days) rendered as a small inline sparkline.
   * Omit for metrics without a meaningful short-term trend (e.g. a point-in-time count). */
  trend?: number[];
  className?: string;
}

/**
 * Dashboard-specific stat card: circular icon badge + label + big number + optional
 * inline sparkline in the corner. Sibling to StatCard.tsx (used by report pages) rather
 * than a modification of it, since report KPIs don't need the icon/sparkline treatment.
 */
export default function DashboardStatCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
  trend,
  className,
}: DashboardStatCardProps) {
  return (
    <Card className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            badgeToneClasses[tone],
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        {trend && trend.length >= 2 && (
          <Sparkline values={trend} className="shrink-0 text-primary" />
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="font-heading text-2xl font-semibold text-text">{value}</span>
        <span className="text-xs font-medium text-text-muted">{label}</span>
      </div>
    </Card>
  );
}
