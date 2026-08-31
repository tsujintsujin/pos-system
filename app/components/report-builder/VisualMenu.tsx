"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon, DotsVerticalIcon } from "@/app/components/ui/icons";
import { cn } from "@/lib/cn";
import type { SortDirection } from "@/lib/report-builder/types";

/**
 * Per-visual overflow menu on a dashboard card.
 *
 * A three-dot menu rather than a bare Remove button: destructive actions sitting exposed
 * on every card invite the mis-click, and there is now more than one thing to do with a
 * visual. Hiding both behind one affordance keeps the card about its chart.
 *
 * Closes on outside click, on Escape, and after any action. Focus returns to the trigger
 * on Escape so keyboard users aren't dropped at the top of the document.
 */
export default function VisualMenu({
  label,
  sortDirection,
  onToggleSort,
  onRename,
  onExport,
  onRemove,
}: {
  /** The visual's name — used only for accessible labelling. */
  label: string;
  sortDirection: SortDirection;
  onToggleSort: () => void;
  onRename: () => void;
  onExport: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  const itemClass =
    "flex w-full cursor-pointer items-center whitespace-nowrap px-3 py-2 text-left text-sm transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary";

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${label}`}
        className={cn(
          "flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition-colors duration-150",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          open ? "bg-bg text-text" : "text-text-muted hover:bg-bg hover:text-text",
        )}
      >
        <DotsVerticalIcon className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`Actions for ${label}`}
          className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-md border border-border bg-surface py-1 shadow-lg"
        >
          {/* Labelled with the order it is currently in, not the one it would switch to —
              a menu reading DESC while showing ascending data is a coin flip. ASC is the
              default for every visual; the arrow points down for it, up for DESC. */}
          <button
            type="button"
            role="menuitem"
            onClick={() => run(onToggleSort)}
            className={cn(itemClass, "justify-between gap-2 text-text hover:bg-bg")}
          >
            <span>{sortDirection === "asc" ? "ASC" : "DESC"}</span>
            <ChevronDownIcon
              className={cn(
                "h-3.5 w-3.5 shrink-0 text-text-muted transition-transform duration-150",
                sortDirection === "asc" ? "rotate-0" : "rotate-180",
              )}
            />
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => run(onRename)}
            className={cn(itemClass, "text-text hover:bg-bg")}
          >
            Rename
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => run(onExport)}
            className={cn(itemClass, "text-text hover:bg-bg")}
          >
            Export
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => run(onRemove)}
            className={cn(itemClass, "text-danger hover:bg-danger-bg")}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
