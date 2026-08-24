"use client";

import { useEffect, useState } from "react";
import { SpinnerIcon } from "@/app/components/ui/icons";

/**
 * Wraps window.fetch once (API calls, Server Actions, and Next's own RSC
 * navigation payloads all go through fetch) to track in-flight request count
 * across the whole app, without threading loading state through every page.
 * Patched on the shared `window.fetch` reference itself, not per-component
 * state, so it survives remounts and stays a single source of truth.
 */
let activeRequests = 0;
const listeners = new Set<(count: number) => void>();
let patched = false;

function notify() {
  for (const listener of listeners) listener(activeRequests);
}

function ensurePatched() {
  if (patched) return;
  patched = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    activeRequests += 1;
    notify();
    try {
      return await originalFetch(...args);
    } finally {
      activeRequests -= 1;
      notify();
    }
  };
}

export default function GlobalProcessingIndicator() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    ensurePatched();
    setCount(activeRequests);
    listeners.add(setCount);
    return () => {
      listeners.delete(setCount);
    };
  }, []);

  if (count === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-[60] flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-2 text-sm font-medium text-text-muted shadow-lg"
    >
      <SpinnerIcon className="h-4 w-4 animate-spin text-primary" />
      Processing…
    </div>
  );
}
