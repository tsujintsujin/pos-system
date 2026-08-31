"use client";

import { useEffect, useState } from "react";
import { SpinnerIcon } from "@/app/components/ui/icons";

/**
 * Tracks two things globally so the indicator matches what's actually still
 * loading, not just "a fetch() call started":
 *
 * 1. In-flight fetches (API calls, Server Actions, Next's own RSC navigation
 *    payloads) — via a single window.fetch wrap. Crucially we don't decrement
 *    when the fetch() promise resolves: that only means response *headers*
 *    arrived. RSC/Suspense responses stream their body, so the promise
 *    resolves well before the page has everything it needs. We instead read
 *    a cloned copy of the body to completion (without delaying what we hand
 *    back to the real caller) and decrement only once the full body is in.
 * 2. In-flight <img> loads — these never go through fetch() at all, so a
 *    product grid's photos finishing after the RSC payload arrives would
 *    otherwise hide the indicator while photos are still popping in. A
 *    MutationObserver catches images added by any navigation, not just ones
 *    present at mount.
 */
let activeRequests = 0;
let pendingImages = 0;
const listeners = new Set<(count: number) => void>();
let patched = false;

function notify() {
  const total = activeRequests + pendingImages;
  for (const listener of listeners) listener(total);
}

function patchFetch() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    activeRequests += 1;
    notify();

    let response: Response;
    try {
      response = await originalFetch(...args);
    } catch (err) {
      activeRequests -= 1;
      notify();
      throw err;
    }

    (async () => {
      try {
        if (response.body) {
          await response.clone().arrayBuffer();
        }
      } catch {
        // Body may be empty/already locked in edge cases — nothing to track then.
      } finally {
        activeRequests -= 1;
        notify();
      }
    })();

    return response;
  };
}

function trackImage(img: HTMLImageElement) {
  if (img.complete) return;
  pendingImages += 1;
  notify();
  const done = () => {
    pendingImages = Math.max(0, pendingImages - 1);
    notify();
    img.removeEventListener("load", done);
    img.removeEventListener("error", done);
  };
  img.addEventListener("load", done);
  img.addEventListener("error", done);
}

function patchImageTracking() {
  document.querySelectorAll("img").forEach((img) => trackImage(img as HTMLImageElement));

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.tagName === "IMG") trackImage(node as HTMLImageElement);
        node.querySelectorAll?.("img").forEach((img) => trackImage(img as HTMLImageElement));
      });
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function ensurePatched() {
  if (patched) return;
  patched = true;
  patchFetch();
  patchImageTracking();
}

export default function GlobalProcessingIndicator() {
  const [count, setCount] = useState(() => activeRequests + pendingImages);

  useEffect(() => {
    ensurePatched();
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
      // `peer-[[role=status]]:*` reacts to DemoBanner, the preceding sibling in
      // <body>: when the read-only demo pill is on screen there is no room for a
      // centered pill and this right-pinned toast on the same row below `md`, so
      // the toast drops under it. No demo pill rendered -> selector never matches.
      className="fixed right-4 top-4 z-[60] flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-2 text-sm font-medium text-text-muted shadow-lg peer-[[role=status]]:top-16 md:peer-[[role=status]]:top-4"
    >
      <SpinnerIcon className="h-4 w-4 animate-spin text-primary" />
      Processing…
    </div>
  );
}
