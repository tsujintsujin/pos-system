"use client";

import Card from "@/app/components/ui/Card";
import Button, { LinkButton } from "@/app/components/ui/Button";

/**
 * Root error boundary for the authenticated app.
 *
 * Without this, an error thrown outside of render — most notably a Server Action
 * whose POST comes back as something the action runtime can't parse — unmounts the
 * whole tree and leaves the user on the browser's own "This page couldn't load"
 * page, with the app's URL still in the address bar and no way back except the
 * back button. The demo role hits exactly that path: proxy.ts answers every demo
 * write with a JSON 403, which the action runtime reports as E394.
 *
 * This keeps the failure inside the app: chrome, navigation and the demo banner
 * all survive, `reset()` re-renders the segment, and there's a link out.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-12">
      <Card className="flex flex-col gap-3">
        <h1 className="font-heading text-lg font-semibold text-text">
          That didn&apos;t go through
        </h1>
        <p className="text-sm text-text-muted">
          Something went wrong completing that action. If you&apos;re signed in to the
          read-only demo, saving changes is disabled — everything else still works.
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-text-muted">Reference: {error.digest}</p>
        )}
        <div className="flex flex-wrap gap-3 pt-1">
          <Button type="button" onClick={reset}>
            Try again
          </Button>
          <LinkButton href="/dashboard" variant="secondary">
            Back to dashboard
          </LinkButton>
        </div>
      </Card>
    </div>
  );
}
