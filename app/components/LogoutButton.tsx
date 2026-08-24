"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPath } from "@/lib/base-path";

export default function LogoutButton() {
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
      className="cursor-pointer rounded-md bg-text px-3 py-2 text-sm font-medium text-surface transition-colors duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loggingOut ? "Signing out…" : "Log out"}
    </button>
  );
}
