"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/app/components/ui/Button";
import { XIcon } from "@/app/components/ui/icons";
import { cn } from "@/lib/cn";
import { VISUALS, getDataset } from "@/lib/report-builder/catalog";
import {
  emptySnapshot,
  parsePublished,
  publishedSnapshot,
  reorderVisuals,
  setVisualActive,
  subscribePublished,
} from "@/lib/report-builder/published";
import { useSyncExternalStore } from "react";

/**
 * Manage what's on the dashboard, and in what order.
 *
 * Two panes. On the left, every published visual with an "active" checkbox — the library,
 * including things parked for later. On the right, the active ones laid out two-up, which
 * is the dashboard's own grid, dragged into the order they should appear in.
 *
 * The right pane is deliberately the same shape as the dashboard rather than a flat list:
 * arranging things in a layout that doesn't resemble the result is guesswork.
 *
 * Drag-and-drop uses the native HTML5 API — no dependency for what is one list of blocks.
 * Order is persisted on drop, so there is no Save button to forget.
 */
export default function ManageVisualsModal({ onClose }: { onClose: () => void }) {
  const visuals = parsePublished(
    useSyncExternalStore(subscribePublished, publishedSnapshot, emptySnapshot),
  );
  // The dragged id lives in a ref, not state: `drop` must read it synchronously, and a
  // state update queued in `dragstart` is not guaranteed to have committed by then. The
  // mirrored state exists only so the blocks can be styled while a drag is in flight.
  const draggedId = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const active = visuals.filter((v) => v.active);

  /** Move the dragged visual to sit where the drop target currently is. */
  const drop = (targetId: string) => {
    const sourceId = draggedId.current;
    if (!sourceId || sourceId === targetId) return;

    const order = visuals.map((v) => v.config.id);
    const from = order.indexOf(sourceId);
    const to = order.indexOf(targetId);
    if (from === -1 || to === -1) return;

    order.splice(to, 0, ...order.splice(from, 1));
    reorderVisuals(order);
    draggedId.current = null;
    setDraggingId(null);
    setOverId(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Manage dashboard visuals"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop — click-through to dismiss, matching Escape. */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-text/40"
      />

      <div className="relative flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div>
            <h2 className="font-heading text-base font-semibold text-text">On the dashboard</h2>
            <p className="mt-0.5 text-xs text-text-muted">
              Tick to show a visual. Drag the blocks on the right to set the order.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-text-muted transition-colors duration-150 hover:bg-bg hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {visuals.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-text-muted">
            Nothing published yet. Build a visual and publish it to pin it here.
          </p>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden md:grid-cols-[18rem_1fr]">
            {/* ---- Library: everything published, with its active toggle ---- */}
            <div className="min-h-0 overflow-y-auto border-border p-4 md:border-r">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                All visuals
              </h3>
              <ul className="flex flex-col gap-1.5">
                {visuals.map((entry) => (
                  <li key={entry.config.id}>
                    <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border p-2.5 transition-colors duration-150 hover:bg-bg">
                      <input
                        type="checkbox"
                        checked={entry.active}
                        onChange={(e) => setVisualActive(entry.config.id, e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-text">
                          {entry.config.name}
                        </span>
                        <span className="block truncate text-xs text-text-muted">
                          {VISUALS.find((v) => v.type === entry.config.visualType)?.label}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            {/* ---- Arrangement: the dashboard's own two-column grid ---- */}
            <div className="min-h-0 overflow-y-auto p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Dashboard order
              </h3>

              {active.length === 0 ? (
                <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-text-muted">
                  No active visuals. Tick one on the left to place it here.
                </p>
              ) : (
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {active.map((entry, index) => (
                    <li
                      key={entry.config.id}
                      draggable
                      onDragStart={(e) => {
                        draggedId.current = entry.config.id;
                        setDraggingId(entry.config.id);
                        // Firefox ignores a drag that carries no payload.
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", entry.config.id);
                      }}
                      onDragEnd={() => {
                        draggedId.current = null;
                        setDraggingId(null);
                        setOverId(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setOverId(entry.config.id);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        drop(entry.config.id);
                      }}
                      className={cn(
                        "flex cursor-grab items-center gap-2 rounded-md border p-3 transition-colors duration-150 active:cursor-grabbing",
                        draggingId === entry.config.id
                          ? "border-primary bg-primary/5 opacity-60"
                          : overId === entry.config.id
                            ? "border-primary bg-primary/5"
                            : "border-border bg-surface hover:bg-bg",
                      )}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bg text-xs font-semibold text-text-muted">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-text">
                          {entry.config.name}
                        </span>
                        <span className="block truncate text-xs text-text-muted">
                          {VISUALS.find((v) => v.type === entry.config.visualType)?.label} ·{" "}
                          {getDataset(entry.config.datasetId)?.label}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end border-t border-border px-5 py-3">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}
