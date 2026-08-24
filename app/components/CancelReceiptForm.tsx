"use client";

import { useState } from "react";
import { voidCompletedSale } from "@/app/actions/sales";
import Textarea from "@/app/components/ui/Textarea";
import Button from "@/app/components/ui/Button";

/**
 * Inline "cancel this whole receipt" confirmation — reason-required, no JS modal (matches
 * AdjustStockForm's open/close toggle pattern). Distinct from, and NOT a substitute for,
 * the Returns flow: this flips Sale.status to VOIDED and restocks inventory, but does not
 * process any refund through Payment — the warning copy below must stay visible before the
 * form can be submitted.
 */
export default function CancelReceiptForm({ saleId, receiptNumber }: { saleId: number; receiptNumber: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" variant="danger" size="sm" onClick={() => setOpen(true)}>
        Cancel receipt
      </Button>
    );
  }

  return (
    <form
      action={voidCompletedSale}
      className="flex w-72 flex-col gap-2 rounded-md border border-danger/40 bg-bg p-3 text-left"
    >
      <input type="hidden" name="saleId" value={saleId} />
      <p className="text-xs font-semibold text-danger">
        This does NOT refund the customer.
      </p>
      <p className="text-xs text-text-muted">
        Cancelling receipt {receiptNumber} marks it VOIDED and restocks every item on it, but
        no refund is processed — Payment records are left as-is. Only use this for a
        same-day mistake where no money has actually changed hands yet. If the customer needs
        money back, use the Returns flow instead.
      </p>
      <Textarea
        name="reason"
        required
        placeholder="Reason (required)"
        className="min-h-16 text-xs"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Back
        </Button>
        <Button type="submit" variant="danger" size="sm">
          Confirm cancel
        </Button>
      </div>
    </form>
  );
}
