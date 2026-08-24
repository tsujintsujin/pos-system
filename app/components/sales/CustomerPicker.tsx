"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { quickAddCustomer } from "@/app/actions/customers";
import type { CustomerSearchResult } from "@/app/api/customers/search/route";
import Button from "@/app/components/ui/Button";
import Input from "@/app/components/ui/Input";
import { UserIcon, XIcon } from "@/app/components/ui/icons";
import { cn } from "@/lib/cn";
import { apiPath } from "@/lib/base-path";

export interface SelectedCustomer {
  id: number;
  name: string;
  storeCreditBalance: number;
}

/**
 * Optional customer attach control for the Sales Terminal cart stage. Search-by-name/
 * phone/email against /api/customers/search, or quick-add a brand-new customer inline via
 * the non-redirecting quickAddCustomer server action (app/actions/customers.ts). Entirely
 * optional — a sale can still be parked/completed with no customer attached, matching
 * Sale.customerId being nullable in the schema.
 */
export default function CustomerPicker({
  customer,
  onChange,
}: {
  customer: SelectedCustomer | null;
  onChange: (customer: SelectedCustomer | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();

    // Both branches' state updates are deferred into the setTimeout callback (rather than
    // the empty-query case setState-ing directly at the top of the effect) so nothing
    // commits synchronously during the effect's own invocation — same pattern as
    // ProductSearch.tsx.
    debounceRef.current = setTimeout(async () => {
      if (!trimmed) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(apiPath(`/api/customers/search?q=${encodeURIComponent(trimmed)}`));
        const data = await res.json();
        setResults(data.results ?? []);
      } finally {
        setLoading(false);
      }
    }, trimmed ? 250 : 0);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function pick(c: CustomerSearchResult) {
    onChange({ id: c.id, name: c.name, storeCreditBalance: c.storeCreditBalance });
    setOpen(false);
    setQuery("");
    setResults([]);
    setShowQuickAdd(false);
  }

  function handleQuickAdd(formData: FormData) {
    setQuickAddError(null);
    const name = String(formData.get("name") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();

    startTransition(async () => {
      try {
        const created = await quickAddCustomer({ name, phone: phone || null, email: email || null });
        // Brand-new customer — no returns/purchases yet, so store credit always starts at 0.
        onChange({ id: created.id, name: created.name, storeCreditBalance: 0 });
        setOpen(false);
        setShowQuickAdd(false);
      } catch (e) {
        setQuickAddError(e instanceof Error ? e.message : "Could not create customer");
      }
    });
  }

  if (customer) {
    return (
      <div className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
        <UserIcon className="h-4 w-4 text-text-muted" />
        <span className="text-text-muted">Customer:</span>
        <span className="font-medium text-text">{customer.name}</span>
        {customer.storeCreditBalance > 0 && (
          <span className="text-xs font-medium text-success">
            ₱{customer.storeCreditBalance.toFixed(2)} store credit
          </span>
        )}
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Remove customer"
          className="ml-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-text-muted transition-colors duration-150 hover:bg-danger-bg hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text",
            "transition-colors duration-150 hover:bg-bg",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          )}
        >
          <UserIcon className="h-4 w-4" />
          Attach customer
        </button>
      ) : (
        <div className="absolute z-10 w-80 rounded-lg border border-border bg-surface p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">Find customer</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-text-muted transition-colors duration-150 hover:bg-bg hover:text-text"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, phone, or email…"
          />
          {loading && <p className="mt-1 text-xs text-text-muted">Searching…</p>}
          {results.length > 0 && (
            <ul className="mt-2 max-h-48 overflow-y-auto">
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => pick(c)}
                    className="flex min-h-11 w-full cursor-pointer flex-col items-start justify-center rounded-md px-2 py-1.5 text-left transition-colors duration-150 hover:bg-bg"
                  >
                    <span className="text-sm font-medium text-text">{c.name}</span>
                    <span className="text-xs text-text-muted">{c.phone ?? c.email ?? "—"}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-2 border-t border-border pt-2">
            {!showQuickAdd ? (
              <button
                type="button"
                onClick={() => setShowQuickAdd(true)}
                className="cursor-pointer text-xs font-medium text-primary underline-offset-2 hover:underline"
              >
                + New customer
              </button>
            ) : (
              <form action={handleQuickAdd} className="flex flex-col gap-2">
                <Input name="name" required placeholder="Name" />
                <Input name="phone" placeholder="Phone (optional)" />
                <Input name="email" placeholder="Email (optional)" />
                {quickAddError && (
                  <p role="alert" className="text-xs text-danger">
                    {quickAddError}
                  </p>
                )}
                <Button type="submit" loading={isPending} size="sm" className="w-full">
                  {isPending ? "Adding…" : "Add & attach"}
                </Button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
