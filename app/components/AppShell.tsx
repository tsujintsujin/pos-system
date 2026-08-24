"use client";

import { useState } from "react";
import Sidebar from "@/app/components/Sidebar";
import { MenuIcon } from "@/app/components/ui/icons";
import { cn } from "@/lib/cn";

/**
 * Shared back-office shell (Dashboard + the (catalog) route group). Below `lg`
 * the sidebar becomes an off-canvas drawer opened via a mobile top bar — at
 * 375-767px there isn't room for a persistent 240px sidebar alongside content.
 */
export default function AppShell({
  userName,
  roleName,
  children,
}: {
  userName: string;
  roleName: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full flex-1">
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Sidebar userName={userName} roleName={roleName} onNavigate={() => setOpen(false)} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-muted transition-colors duration-150 hover:bg-bg hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <span className="font-heading text-base font-semibold tracking-tight text-text">
            POS System
          </span>
        </div>

        <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col gap-6 px-6 py-8">
          {children}
        </div>
      </div>
    </div>
  );
}
