"use client";

import { useEffect, useState } from "react";
import type { ParkedSaleSummary } from "@/app/api/sales/parked/route";
import Button from "@/app/components/ui/Button";
import EmptyState from "@/app/components/ui/EmptyState";
import { CartIcon, XIcon } from "@/app/components/ui/icons";
import { apiPath } from "@/lib/base-path";

export default function ParkedSalesPanel({
  open,
  onClose,
  onResume,
}: {
  open: boolean;
  onClose: () => void;
  onResume: (saleId: number) => void;
}) {
  const [sales, setSales] = useState<ParkedSaleSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    // Wrapped in an async IIFE (rather than setState called directly at the top level of
    // the effect) so state updates happen inside a nested callback, not synchronously
    // during the effect's own invocation.
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(apiPath("/api/sales/parked"));
        const data = await res.json();
        if (!cancelled) setSales(data.results ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-text/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Parked sales"
    >
      <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-surface p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <h2 className="font-heading text-lg font-semibold text-text">Parked sales</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-text-muted transition-colors duration-150 hover:bg-bg hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {loading && <p className="text-sm text-text-muted">Loading…</p>}
        {!loading && sales.length === 0 && (
          <EmptyState icon={<CartIcon className="h-8 w-8 text-text-muted" />} message="No parked sales right now." />
        )}

        <ul className="flex flex-col gap-2">
          {sales.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
            >
              <div>
                <div className="text-sm font-medium text-text">
                  #{s.id} · {s.itemCount} item{s.itemCount === 1 ? "" : "s"}
                </div>
                <div className="text-xs text-text-muted">
                  {s.cashierName} · {new Date(s.createdAt).toLocaleTimeString()}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-text">₱{s.grandTotal.toFixed(2)}</span>
                <Button type="button" size="sm" onClick={() => onResume(s.id)}>
                  Resume
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
