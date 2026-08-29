"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPath } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { LogoutArrowIcon } from "@/app/components/ui/icons";

export default function LogoutButton({ collapsed = false }: { collapsed?: boolean }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch(apiPath("/api/auth/logout"), { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loggingOut}
      title={collapsed ? "Log out" : undefined}
      aria-label={collapsed ? "Log out" : undefined}
      className={cn(
        "cursor-pointer rounded-md bg-text text-sm font-medium text-surface transition-colors duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
        // Paired max-lg:/lg: rather than base + lg: override — see the note in Sidebar.tsx.
        collapsed
          ? "max-lg:px-3 max-lg:py-2 lg:flex lg:w-full lg:items-center lg:justify-center lg:px-0 lg:py-2.5"
          : "px-3 py-2",
      )}
    >
      <span className={cn(collapsed && "lg:hidden")}>{loggingOut ? "Signing out…" : "Log out"}</span>
      <LogoutArrowIcon className={cn("h-4 w-4", collapsed ? "hidden lg:block" : "hidden")} />
    </button>
  );
}
