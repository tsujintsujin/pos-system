"use client";

import { useEffect, useState } from "react";
import Button from "@/app/components/ui/Button";
import Input from "@/app/components/ui/Input";
import { XIcon } from "@/app/components/ui/icons";
import { renameVisual } from "@/lib/report-builder/published";

/**
 * Rename a published visual.
 *
 * Opens with the current name selected, so the common case — replace it entirely — is one
 * keystroke. Enter saves, Escape cancels, and an empty name is refused rather than
 * silently ignored: a blank card title is indistinguishable from a broken one.
 */
export default function RenameVisualModal({
  id,
  currentName,
  onClose,
}: {
  id: string;
  currentName: string;
  onClose: () => void;
}) {
  const [name, setName] = useState(currentName);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const trimmed = name.trim();
  const canSave = trimmed.length > 0;

  const save = () => {
    if (!canSave) return;
    renameVisual(id, trimmed);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Rename visual"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-text/40"
      />

      <div className="relative w-full max-w-md overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <h2 className="font-heading text-base font-semibold text-text">Rename visual</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-text-muted transition-colors duration-150 hover:bg-bg hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-2 px-5 py-4">
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Name
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  save();
                }
              }}
              placeholder="e.g. Revenue by category"
            />
          </label>
          {!canSave && <p className="text-xs text-danger">A visual needs a name.</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!canSave}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
