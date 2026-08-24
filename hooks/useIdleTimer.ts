"use client";

import { useEffect, useRef } from "react";

const DEFAULT_IDLE_MS = 5 * 60 * 1000; // 5 minutes

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "wheel",
];

/**
 * Fires `onIdle` after `idleMs` of no mouse/keyboard/touch/scroll activity.
 * Intended for the sales-terminal idle lock (see PIN quick-switch at /switch-user).
 */
export function useIdleTimer(onIdle: () => void, idleMs: number = DEFAULT_IDLE_MS) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onIdleRef = useRef(onIdle);

  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    function resetTimer() {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => onIdleRef.current(), idleMs);
    }

    resetTimer();
    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, resetTimer, { passive: true })
    );

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [idleMs]);
}
