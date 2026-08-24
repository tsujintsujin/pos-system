"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useIdleTimer } from "@/hooks/useIdleTimer";

/**
 * Wrap authenticated-area pages with this to auto-redirect to the PIN lock screen
 * after 5 minutes of no keyboard/mouse/touch activity. Resuming re-uses the PIN
 * quick-switch flow at /switch-user (see app/switch-user/page.tsx, /api/auth/pin).
 */
export default function IdleLockGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const handleIdle = useCallback(() => {
    router.push("/switch-user?locked=1");
  }, [router]);

  useIdleTimer(handleIdle);

  return <>{children}</>;
}
