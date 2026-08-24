import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium cursor-pointer " +
  "transition-colors duration-200 focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed " +
  "disabled:opacity-60 disabled:pointer-events-none";

const sizeClasses: Record<ButtonSize, string> = {
  // min-h-11 (44px) keeps every button a valid touch target per the POS/tablet requirement.
  md: "min-h-11 px-4 text-sm",
  sm: "min-h-11 px-3 text-xs",
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover",
  secondary: "border border-border bg-surface text-text hover:bg-bg",
  danger: "bg-danger text-white hover:bg-danger-hover",
  ghost: "text-text-muted hover:bg-bg hover:text-text",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
) {
  return cn(base, sizeClasses[size], variantClasses[variant], className);
}
