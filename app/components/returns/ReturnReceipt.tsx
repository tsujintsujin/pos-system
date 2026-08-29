"use client";

import { useEffect, useState } from "react";
import type { ReturnReceiptData } from "@/app/api/returns/[id]/receipt/route";
import Button from "@/app/components/ui/Button";
import ProductLink from "@/app/components/ui/ProductLink";
import { CheckCircleIcon, PrinterIcon, SpinnerIcon } from "@/app/components/ui/icons";
import { apiPath } from "@/lib/base-path";

/** Confirmation view after a return completes — same narrow/print styling as app/components/sales/Receipt.tsx. */
export default function ReturnReceipt({ returnId, onNewReturn }: { returnId: number; onNewReturn: () => void }) {
  const [data, setData] = useState<ReturnReceiptData | null>(null);

  useEffect(() => {
    fetch(apiPath(`/api/returns/${returnId}/receipt`))
      .then((r) => r.json())
      .then(setData);
  }, [returnId]);

  if (!data) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-muted">
        <SpinnerIcon className="h-5 w-5 animate-spin" />
        Loading return receipt…
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex flex-col items-center gap-1.5 text-success">
        <CheckCircleIcon className="h-10 w-10" />
        <p className="font-heading text-lg font-semibold text-text">Return complete</p>
      </div>

      {/* Do not remove this id — app/globals.css's @media print rule isolates this
          element as the only visible content when the cashier prints the receipt. */}
      <div
        id="receipt-print-area"
        className="w-full max-w-[320px] rounded-lg border border-border bg-surface p-5 font-mono text-xs text-text shadow-sm"
      >
        <div className="mb-2 text-center">
          <div className="text-sm font-bold">RETURN / REFUND</div>
          <div>Return #{data.id}</div>
          <div>Original: {data.originalReceiptNumber}</div>
          <div>{new Date(data.createdAt).toLocaleString()}</div>
          <div>Processed by: {data.processedByName}</div>
        </div>
        <div className="my-2 border-t border-dashed border-border" />
        {data.lines.map((l, i) => (
          <div key={i} className="mb-1 flex justify-between gap-2">
            <span className="flex-1">
              <ProductLink productId={l.productId} className="font-normal print:no-underline">
                {l.name}
              </ProductLink>
              <br />
              <span className="text-text-muted">
                qty {l.quantityReturned} {l.restocked ? "(restocked)" : "(not restocked)"}
              </span>
            </span>
            <span>₱{l.refundAmount.toFixed(2)}</span>
          </div>
        ))}
        <div className="my-2 border-t border-dashed border-border" />
        {data.reason && (
          <div className="mb-2">
            <span className="text-text-muted">Reason: </span>
            {data.reason}
          </div>
        )}
        <div className="flex justify-between">
          <span>Refund method</span>
          <span>{data.refundMethod.replace("_", " ")}</span>
        </div>
        <div className="flex justify-between text-sm font-bold">
          <span>Total refunded</span>
          <span>₱{data.totalRefunded.toFixed(2)}</span>
        </div>
      </div>

      <div className="flex gap-3 print:hidden">
        <Button type="button" variant="secondary" onClick={() => window.print()}>
          <PrinterIcon className="h-4 w-4" />
          Print receipt
        </Button>
        <Button type="button" variant="primary" onClick={onNewReturn} className="min-w-40">
          New return
        </Button>
      </div>
    </div>
  );
}
