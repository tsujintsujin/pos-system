"use client";

import { useState } from "react";
import Button from "@/app/components/ui/Button";
import { BackspaceIcon, LockIcon } from "@/app/components/ui/icons";
import { cn } from "@/lib/cn";
import { apiPath } from "@/lib/base-path";

const MAX_PIN_LENGTH = 8;
const MIN_DOTS = 4;

const keypadButtonClasses = cn(
  "flex min-h-14 items-center justify-center rounded-md border border-border bg-surface",
  "text-lg font-medium text-text cursor-pointer transition-colors duration-200 hover:bg-bg",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
  "disabled:cursor-not-allowed disabled:opacity-60",
);

/**
 * One-time manager-approval PIN entry for refunds over MANAGER_APPROVAL_THRESHOLD
 * (see app/actions/returns.ts). Calls /api/returns/verify-manager-pin for instant
 * feedback — this does NOT swap the session (unlike /switch-user's quick-switch flow),
 * it's just a stamp of approval. The raw PIN is handed back to the caller so it can be
 * re-sent with the final completeReturn call for a true server-side re-check.
 *
 * Same large touch-keypad + dot-progress pattern as /switch-user, presented as a modal
 * dialog instead of a full page since it's a brief in-flow interruption of the return form.
 */
export default function ManagerPinModal({
  onApproved,
  onCancel,
}: {
  onApproved: (managerName: string, pin: string) => void;
  onCancel: () => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  async function handleVerify() {
    if (!pin.trim()) {
      setError("Enter a PIN");
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch(apiPath("/api/returns/verify-manager-pin"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Invalid PIN");
        setPin("");
        return;
      }
      onApproved(data.manager.name, pin);
    } catch {
      setError("Could not verify PIN — try again");
    } finally {
      setVerifying(false);
    }
  }

  function appendDigit(digit: string) {
    if (verifying) return;
    setError(null);
    setPin((prev) => (prev.length < MAX_PIN_LENGTH ? prev + digit : prev));
  }

  function backspace() {
    if (verifying) return;
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  }

  function clear() {
    if (verifying) return;
    setError(null);
    setPin("");
  }

  const dotCount = Math.max(pin.length, MIN_DOTS);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !verifying) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="manager-pin-title"
        className="w-full max-w-xs rounded-lg bg-surface p-6 text-center shadow-lg"
      >
        <div className="mb-3 flex justify-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-warning-bg text-warning">
            <LockIcon className="h-5 w-5" />
          </span>
        </div>
        <h2 id="manager-pin-title" className="font-heading text-lg font-semibold text-text">
          Manager approval required
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          This refund is above the approval threshold. Ask a manager to enter their PIN.
        </p>

        <div className="mt-5 flex flex-col items-center gap-4">
          <label htmlFor="manager-pin" className="sr-only">
            Manager PIN
          </label>
          <input
            id="manager-pin"
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(e) => {
              setError(null);
              setPin(e.target.value.replace(/\D/g, "").slice(0, MAX_PIN_LENGTH));
            }}
            onKeyDown={(e) => e.key === "Enter" && handleVerify()}
            className="sr-only"
            maxLength={MAX_PIN_LENGTH}
            aria-describedby="manager-pin-dots"
          />

          {/* Visual PIN progress — the real value lives in the input above (also keyboard-editable). */}
          <div
            id="manager-pin-dots"
            role="status"
            aria-label={`${pin.length} digit${pin.length === 1 ? "" : "s"} entered`}
            className="flex min-h-11 w-full items-center justify-center gap-3 rounded-md border border-border bg-bg px-3 py-3"
          >
            {Array.from({ length: dotCount }).map((_, i) => (
              <span
                key={i}
                aria-hidden="true"
                className={cn(
                  "h-3 w-3 rounded-full transition-colors duration-200",
                  i < pin.length ? "bg-primary" : "bg-border",
                )}
              />
            ))}
          </div>

          {/* Touch keypad — same 44px+ targets as /switch-user, sized for a manager to enter quickly at the register. */}
          <div className="grid w-full grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => appendDigit(digit)}
                disabled={verifying}
                className={keypadButtonClasses}
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={clear}
              disabled={verifying}
              className={cn(keypadButtonClasses, "text-xs font-medium text-text-muted")}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => appendDigit("0")}
              disabled={verifying}
              className={keypadButtonClasses}
            >
              0
            </button>
            <button
              type="button"
              onClick={backspace}
              disabled={verifying}
              aria-label="Delete last digit"
              className={keypadButtonClasses}
            >
              <BackspaceIcon className="h-5 w-5" />
            </button>
          </div>

          {error && (
            <p
              role="alert"
              className="w-full rounded-md border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          )}

          <div className="flex w-full gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              disabled={verifying}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleVerify}
              disabled={verifying || pin.length === 0}
              loading={verifying}
              className="flex-1"
            >
              {verifying ? "Verifying…" : "Approve"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
