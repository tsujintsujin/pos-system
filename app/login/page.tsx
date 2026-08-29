"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Card from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Button from "@/app/components/ui/Button";
import { apiPath } from "@/lib/base-path";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [demoLoading, setDemoLoading] = useState(false);

  async function handleDemo() {
    setError(null);
    setDemoLoading(true);
    try {
      const res = await fetch(apiPath("/api/auth/demo"), { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? "The demo is unavailable right now.");
        setDemoLoading(false);
        return;
      }
      // Hard navigation on purpose. router.push() followed by router.refresh()
      // races here — the refresh re-renders the current (login) route and the
      // pending RSC navigation to /dashboard is discarded, leaving the button
      // stuck on "Starting demo…" even though the session cookie was set and
      // the server rendered /dashboard successfully. A full page load always
      // picks up the new httpOnly cookie, and this path runs exactly once.
      window.location.assign(apiPath(from ?? "/dashboard"));
    } catch {
      setError("Could not start the demo. Check your connection and try again.");
      setDemoLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    // Read straight from the DOM via FormData rather than React-controlled state —
    // browser/password-manager autofill fills inputs visually without always firing
    // the `input`/`change` events React listens for, which left controlled state
    // stuck at "" and silently submitted an empty email/password. FormData always
    // reflects whatever's actually in the fields at submit time, typed or autofilled.
    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    try {
      const res = await fetch(apiPath("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Login failed");
        return;
      }

      router.push(from && from !== "/login" ? from : "/dashboard");
      router.refresh();
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-bg px-4 py-12">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-8 text-center">
          <p className="font-heading text-2xl font-semibold tracking-tight text-text">
            POS System
          </p>
          <p className="mt-2 text-sm text-text-muted">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-text">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="username"
              placeholder="admin@possystem.local"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-text">
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Enter your password"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-md border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            loading={submitting}
            disabled={submitting}
            className="mt-2 w-full"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="mt-6 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase tracking-wide text-text-muted">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={handleDemo}
          loading={demoLoading}
          disabled={demoLoading || submitting}
          className="mt-4 w-full"
        >
          {demoLoading ? "Starting demo…" : "Try the demo"}
        </Button>
        <p className="mt-2 text-center text-xs text-text-muted">
          Explore the full system with sample data. Read-only — nothing you do is saved.
        </p>

        <p className="mt-6 text-center text-xs text-text-muted">
          Shared terminal?{" "}
          <Link
            href="/switch-user"
            className="cursor-pointer font-medium text-primary underline-offset-2 hover:underline"
          >
            Switch user with PIN
          </Link>
        </p>
      </Card>
    </div>
  );
}
