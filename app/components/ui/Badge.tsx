import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type BadgeVariant = "success" | "danger" | "warning" | "neutral" | "info";

const variantClasses: Record<BadgeVariant, string> = {
  success: "bg-success-bg text-success border-success-border",
  danger: "bg-danger-bg text-danger border-danger-border",
  warning: "bg-warning-bg text-warning border-warning-border",
  info: "bg-info-bg text-info border-info-border",
  neutral: "bg-bg text-text-muted border-border",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

/**
 * Status pill — replaces the ad hoc `<span className="rounded bg-red-50 ...">`
 * pattern scattered across sale status, PO status, and stock-level flags.
 */
export default function Badge({ variant = "neutral", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
