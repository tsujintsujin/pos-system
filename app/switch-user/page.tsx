"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Card from "@/app/components/ui/Card";
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

export default function SwitchUserPage() {
  return (
    <Suspense fallback={null}>
      <PinForm />
    </Suspense>
  );
}

function PinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locked = searchParams.get("locked") === "1";

  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submitPin(value: string) {
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(apiPath("/api/auth/pin"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: value }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "PIN not recognized");
        setPin("");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Defensive: read the hidden input's actual DOM value at submit time rather than
    // trusting only React state — same class of autofill risk as the login form (a
    // password manager can target any type="password" field, even a visually-hidden
    // one), and this is cheap insurance against it silently submitting a stale value.
    const domValue = String(new FormData(e.currentTarget).get("pin") ?? "").replace(/\D/g, "");
    const value = domValue || pin;
    if (value.length === 0 || submitting) return;
    void submitPin(value);
  }

  function appendDigit(digit: string) {
    if (submitting) return;
    setError(null);
    setPin((prev) => (prev.length < MAX_PIN_LENGTH ? prev + digit : prev));
  }

  function backspace() {
    if (submitting) return;
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  }

  function clear() {
    if (submitting) return;
    setError(null);
    setPin("");
  }

  const dotCount = Math.max(pin.length, MIN_DOTS);

  return (
    <div className="flex flex-1 items-center justify-center bg-bg px-4 py-12">
      <Card className="w-full max-w-xs p-8 text-center">
        {locked && (
          <div className="mb-3 flex justify-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-warning-bg text-warning">
              <LockIcon className="h-5 w-5" />
            </span>
          </div>
        )}
        <h1 className="font-heading text-xl font-semibold text-text">
          {locked ? "Session locked" : "Switch user"}
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          {locked ? "Enter your PIN to resume" : "Enter a staff PIN to switch"}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col items-center gap-5" noValidate>
          <label htmlFor="pin" className="sr-only">
            PIN
          </label>
          <input
            id="pin"
            name="pin"
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(e) => {
              setError(null);
              setPin(e.target.value.replace(/\D/g, "").slice(0, MAX_PIN_LENGTH));
            }}
            className="sr-only"
            maxLength={MAX_PIN_LENGTH}
            aria-describedby="pin-dots"
          />

          {/* Visual PIN progress — the real value lives in the input above (also keyboard-editable). */}
          <div
            id="pin-dots"
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

          {/* Touch keypad — 44px+ targets for fast entry on a locked-out register. */}
          <div className="grid w-full grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => appendDigit(digit)}
                disabled={submitting}
                className={keypadButtonClasses}
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={clear}
              disabled={submitting}
              className={cn(keypadButtonClasses, "text-xs font-medium text-text-muted")}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => appendDigit("0")}
              disabled={submitting}
              className={keypadButtonClasses}
            >
              0
            </button>
            <button
              type="button"
              onClick={backspace}
              disabled={submitting}
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

          <Button
            type="submit"
            loading={submitting}
            disabled={submitting || pin.length === 0}
            className="w-full"
          >
            {submitting ? "Checking…" : "Continue"}
          </Button>
        </form>

        <p className="mt-6 text-xs text-text-muted">
          <a
            href="/login"
            className="cursor-pointer font-medium text-primary underline-offset-2 hover:underline"
          >
            Log in with email instead
          </a>
        </p>
      </Card>
    </div>
  );
}
