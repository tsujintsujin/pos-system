"use client";

import { coerceConfig } from "./config";
import type { PublishedVisual, ReportConfig } from "./types";

/**
 * Report builder — published-visual storage.
 *
 * DRAFT LIMITATION, stated plainly: published visuals live in the browser's localStorage,
 * not in the POS database. That keeps this feature from requiring a schema change, but it
 * means "published" is per-browser — another admin on another machine won't see them, and
 * clearing site data loses them. Shipping this for real means moving `load`/`save` behind
 * a `dashboard_visuals` table; nothing outside this file needs to change when that
 * happens, which is why every read and write funnels through here.
 *
 * Every accessor is wrapped: localStorage throws outright in some contexts (private
 * windows with site data blocked), and a dashboard that white-screens because a storage
 * read failed would be a poor trade for a convenience feature.
 */

const STORAGE_KEY = "pos.reportBuilder.published.v2";

/** Fired on the window after any local mutation, so same-tab listeners can refresh. */
const CHANGE_EVENT = "pos:published-visuals-changed";

/**
 * The raw stored string, used as a `useSyncExternalStore` snapshot. It has to be the
 * string rather than a parsed array: the snapshot is compared by identity every render,
 * and parsing would hand React a brand-new array each time and loop forever.
 */
export function publishedSnapshot(): string {
  if (typeof window === "undefined") return "[]";
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

/** Server snapshot — there is no browser storage during SSR, so nothing is published. */
export function emptySnapshot(): string {
  return "[]";
}

/**
 * Parse a stored snapshot into visuals. Every config is re-derived through the catalog:
 * storage is as untrusted as a request body, and may hold visuals saved before a field
 * was renamed or removed.
 */
export function parsePublished(raw: string): PublishedVisual[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry): PublishedVisual[] => {
      if (!entry || typeof entry !== "object") return [];
      const record = entry as Record<string, unknown>;
      const config = coerceConfig(record.config);
      if (!config) return [];
      return [
        {
          config,
          publishedAt:
            typeof record.publishedAt === "string" ? record.publishedAt : new Date().toISOString(),
          // Visuals stored before `active` existed were, by definition, being shown.
          active: typeof record.active === "boolean" ? record.active : true,
        },
      ];
    });
  } catch {
    return [];
  }
}

export function loadPublished(): PublishedVisual[] {
  return parsePublished(publishedSnapshot());
}

function save(visuals: PublishedVisual[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visuals));
  } catch {
    // Quota exceeded or storage blocked — the in-memory list the caller holds is still
    // correct for this session, so there is nothing useful to do but carry on.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Publish a visual, replacing any earlier version of the same id. Re-publishing an edited
 * visual updates the dashboard in place rather than stacking duplicates.
 */
export function publishVisual(config: ReportConfig): PublishedVisual[] {
  const current = loadPublished();
  const existing = current.find((v) => v.config.id === config.id);
  const entry: PublishedVisual = {
    config,
    publishedAt: new Date().toISOString(),
    active: existing?.active ?? true,
  };

  // Re-publishing an edit replaces the entry *in place*, so an updated visual doesn't jump
  // to the end of the dashboard.
  const next = existing
    ? current.map((v) => (v.config.id === config.id ? entry : v))
    : [...current, entry];

  save(next);
  return next;
}

/**
 * Rename a published visual in place. The name is a label, not identity — the id is what
 * the dashboard order and every other reference are keyed on — so renaming never disturbs
 * position or active state.
 */
export function renameVisual(id: string, name: string): PublishedVisual[] {
  const trimmed = name.trim();
  if (!trimmed) return loadPublished();

  const next = loadPublished().map((v) =>
    v.config.id === id ? { ...v, config: { ...v.config, name: trimmed } } : v,
  );
  save(next);
  return next;
}

/** Show or hide a visual on the dashboard without discarding its definition. */
export function setVisualActive(id: string, active: boolean): PublishedVisual[] {
  const next = loadPublished().map((v) => (v.config.id === id ? { ...v, active } : v));
  save(next);
  return next;
}

/**
 * Persist a new dashboard order. Takes the full id sequence rather than a from/to pair so
 * a drag that moves several positions is one write, and anything the caller omits keeps
 * its relative place at the end rather than vanishing.
 */
export function reorderVisuals(orderedIds: string[]): PublishedVisual[] {
  const current = loadPublished();
  const byId = new Map(current.map((v) => [v.config.id, v]));

  const ordered = orderedIds
    .map((id) => byId.get(id))
    .filter((v): v is PublishedVisual => Boolean(v));

  const remaining = current.filter((v) => !orderedIds.includes(v.config.id));
  const next = [...ordered, ...remaining];

  save(next);
  return next;
}

export function deleteVisual(id: string): PublishedVisual[] {
  const next = loadPublished().filter((v) => v.config.id !== id);
  save(next);
  return next;
}

/** Subscribe to changes from this tab and from others. Returns an unsubscribe function. */
export function subscribePublished(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}
