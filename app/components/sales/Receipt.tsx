"use client";

import { useEffect, useState } from "react";
import type { ReceiptData } from "@/app/api/sales/[id]/receipt/route";
import Button from "@/app/components/ui/Button";
import { CheckCircleIcon, PrinterIcon, SpinnerIcon } from "@/app/components/ui/icons";
import { apiPath } from "@/lib/base-path";

/**
 * On-screen receipt formatted narrow (80mm-ish) with a browser print button. Per the
 * plan, silent/direct ESC-POS printing is explicitly deferred — window.print() + the
 * @media print rule below (see app/globals.css) is enough for v1.
 */
export default function Receipt({
  saleId,
  currencySymbol,
  receiptLogoUrl,
  receiptFooterText,
  onNewSale,
}: {
  saleId: number;
  currencySymbol: string;
  receiptLogoUrl: string | null;
  receiptFooterText: string | null;
  onNewSale: () => void;
}) {
  const [data, setData] = useState<ReceiptData | null>(null);

  useEffect(() => {
    fetch(apiPath(`/api/sales/${saleId}/receipt`))
      .then((r) => r.json())
      .then(setData);
  }, [saleId]);

  if (!data) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-muted">
        <SpinnerIcon className="h-5 w-5 animate-spin" />
        Loading receipt…
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex flex-col items-center gap-1.5 text-success">
        <CheckCircleIcon className="h-10 w-10" />
        <p className="font-heading text-lg font-semibold text-text">Sale complete</p>
      </div>

      {/* Do not remove this id — app/globals.css's @media print rule isolates this
          element as the only visible content when the cashier prints the receipt. */}
      <div
        id="receipt-print-area"
        className="w-full max-w-[320px] rounded-lg border border-border bg-surface p-5 font-mono text-xs text-text shadow-sm"
      >
        <div className="mb-2 text-center">
          {receiptLogoUrl && (
            // Same plain-<img>-no-upload pattern as Product.imageUrl / Location.receiptLogoUrl
            // on the store profile settings page — no remotePatterns needed for an arbitrary
            // external URL, and a broken URL just falls back to the browser's default icon.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={receiptLogoUrl}
              alt={data.locationName}
              className="mx-auto mb-1.5 h-10 w-10 object-contain"
            />
          )}
          <div className="text-sm font-bold">{data.locationName}</div>
          <div>{data.receiptNumber}</div>
          <div>{new Date(data.completedAt ?? data.createdAt).toLocaleString()}</div>
          <div>Cashier: {data.cashierName}</div>
        </div>
        <div className="my-2 border-t border-dashed border-border" />
        {data.lines.map((l, i) => (
          <div key={i} className="mb-1 flex justify-between gap-2">
            <span className="flex-1">
              {l.name}
              <br />
              <span className="text-text-muted">
                {l.quantity} x {currencySymbol}
                {l.unitPrice.toFixed(2)}
              </span>
            </span>
            <span>
              {currencySymbol}
              {l.lineTotal.toFixed(2)}
            </span>
          </div>
        ))}
        <div className="my-2 border-t border-dashed border-border" />
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>
            {currencySymbol}
            {data.subtotal.toFixed(2)}
          </span>
        </div>
        {data.discountTotal > 0 && (
          <div className="flex justify-between">
            <span>Discount</span>
            <span>
              -{currencySymbol}
              {data.discountTotal.toFixed(2)}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Tax</span>
          <span>
            {currencySymbol}
            {data.taxTotal.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between text-sm font-bold">
          <span>Total</span>
          <span>
            {currencySymbol}
            {data.grandTotal.toFixed(2)}
          </span>
        </div>
        <div className="my-2 border-t border-dashed border-border" />
        {data.payments.map((p, i) => (
          <div key={i} className="flex justify-between">
            <span>{p.methodName}</span>
            <span>
              {currencySymbol}
              {p.amount.toFixed(2)}
            </span>
          </div>
        ))}
        {data.payments.some((p) => (p.changeGiven ?? 0) > 0) && (
          <div className="flex justify-between font-bold">
            <span>Change</span>
            <span>
              {currencySymbol}
              {data.payments.reduce((s, p) => s + (p.changeGiven ?? 0), 0).toFixed(2)}
            </span>
          </div>
        )}
        <div className="mt-3 text-center">Thank you!</div>
        {receiptFooterText && (
          <div className="mt-1 text-center text-text-muted">{receiptFooterText}</div>
        )}
      </div>

      <div className="flex gap-3 print:hidden">
        <Button type="button" variant="secondary" onClick={() => window.print()}>
          <PrinterIcon className="h-4 w-4" />
          Print receipt
        </Button>
        <Button type="button" variant="primary" onClick={onNewSale} className="min-w-40">
          New sale
        </Button>
      </div>
    </div>
  );
}
