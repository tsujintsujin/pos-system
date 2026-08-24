import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import Card from "./Card";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  subLabel?: ReactNode;
  tone?: "neutral" | "success" | "danger" | "warning";
  className?: string;
}

const toneClasses: Record<NonNullable<StatCardProps["tone"]>, string> = {
  neutral: "text-text",
  success: "text-success",
  danger: "text-danger",
  warning: "text-warning",
};

/** Label + big number + optional sub-label, for dashboard tiles and report KPIs. */
export default function StatCard({ label, value, subLabel, tone = "neutral", className }: StatCardProps) {
  return (
    <Card className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</span>
      <span className={cn("font-heading text-2xl font-semibold", toneClasses[tone])}>{value}</span>
      {subLabel && <span className="text-xs text-text-muted">{subLabel}</span>}
    </Card>
  );
}
