import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeftIcon } from "./icons";

export interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
}

/**
 * Title + optional back-link + optional right-aligned actions slot.
 * Replaces the hand-rolled `<header className="flex items-center justify-between border-b...">`
 * pattern repeated across back-office pages.
 */
export default function PageHeader({
  title,
  subtitle,
  backHref,
  backLabel = "Back",
  actions,
}: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
      <div className="flex flex-col gap-1">
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex w-fit min-h-11 cursor-pointer items-center gap-1 rounded-md text-sm font-medium text-text-muted transition-colors duration-150 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            {backLabel}
          </Link>
        )}
        <h1 className="font-heading text-2xl font-semibold text-text">{title}</h1>
        {subtitle && <p className="text-sm text-text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
