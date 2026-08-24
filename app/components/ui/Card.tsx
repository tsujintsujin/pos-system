import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export default function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface p-4 shadow-sm",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
