import type { ReactNode } from "react";
import { InboxIcon } from "./icons";

export interface EmptyStateProps {
  message: string;
  subMessage?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}

/** "No data yet" placeholder — replaces ad hoc "No X yet." text scattered across pages. */
export default function EmptyState({ message, subMessage, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-bg px-6 py-10 text-center">
      {icon ?? <InboxIcon className="h-8 w-8 text-text-muted" />}
      <p className="text-sm font-medium text-text">{message}</p>
      {subMessage && <p className="text-sm text-text-muted">{subMessage}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
