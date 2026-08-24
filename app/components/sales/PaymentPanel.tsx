"use client";

import { useMemo, useState } from "react";
import type { PaymentInput } from "@/app/actions/sales";
import type { SelectedCustomer } from "@/app/components/sales/CustomerPicker";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import { CardIcon, CashIcon, TrashIcon, WalletIcon } from "@/app/components/ui/icons";
import { cn } from "@/lib/cn";
import { roundToCashIncrement } from "@/lib/sales-calc";

interface PaymentMethodOption {
  id: number;
  name: string;
}

/**
 * One row per tender. Cash rows compute change from the entered "amount tendered" against
 * the amount being applied to this sale; the split-payment case is just "add another row"
 * — the cashier decides how much of the grand total each row covers.
 */
interface PaymentRow {
  key: string;
  paymentMethodId: number;
  amount: string;
  tendered: string;
}

function isCash(name: string) {
  return name.toLowerCase() === "cash";
}

function isStoreCredit(name: string) {
  return name.toLowerCase() === "store credit";
}

function methodIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower === "cash") return CashIcon;
  if (lower === "card") return CardIcon;
  return WalletIcon;
}

const numberFieldClasses = cn(
  "min-h-11 w-32 rounded-md border border-border bg-surface px-3 py-2 text-right text-sm text-text",
  "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
  "transition-colors duration-200",
);

export default function PaymentPanel({
  grandTotal,
  currencySymbol,
  cashRoundingIncrement,
  paymentMethods,
  customer,
  onCancel,
  onSubmit,
  submitting,
}: {
  grandTotal: number;
  currencySymbol: string;
  /** null/0 = no rounding, matching Location.cashRoundingIncrement's documented convention. */
  cashRoundingIncrement: number | null;
  paymentMethods: PaymentMethodOption[];
  customer: SelectedCustomer | null;
  onCancel: () => void;
  onSubmit: (payments: PaymentInput[]) => void;
  submitting: boolean;
}) {
  // "Store Credit" only makes sense as a tender when a customer is attached AND has a
  // positive balance to spend — hide the tab entirely otherwise rather than showing a
  // dead-end option (same "don't show what can't be used" reasoning as elsewhere in this UI).
  const availableMethods = useMemo(
    () =>
      paymentMethods.filter((m) => {
        if (!isStoreCredit(m.name)) return true;
        return !!customer && customer.storeCreditBalance > 0;
      }),
    [paymentMethods, customer],
  );

  const defaultMethodId = availableMethods.find((m) => !isStoreCredit(m.name))?.id ?? availableMethods[0]?.id ?? 0;
  const [rows, setRows] = useState<PaymentRow[]>([
    { key: crypto.randomUUID(), paymentMethodId: defaultMethodId, amount: grandTotal.toFixed(2), tendered: "" },
  ]);

  const totalApplied = useMemo(
    () => rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
    [rows],
  );
  const remaining = Math.round((grandTotal - totalApplied + Number.EPSILON) * 100) / 100;
  const balanced = Math.abs(remaining) < 0.01;

  function methodName(id: number) {
    return availableMethods.find((m) => m.id === id)?.name ?? "";
  }

  // Max store credit a given row can carry: the customer's balance minus whatever other
  // rows already have applied against it (covers the split-payment case where the cashier
  // adds more than one store-credit row, which the UI otherwise allows like any method).
  function storeCreditCapFor(key: string) {
    const balance = customer?.storeCreditBalance ?? 0;
    const usedByOtherRows = rows
      .filter((r) => r.key !== key && isStoreCredit(methodName(r.paymentMethodId)))
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    return Math.max(0, Math.round((balance - usedByOtherRows + Number.EPSILON) * 100) / 100);
  }

  function updateRow(key: string, patch: Partial<PaymentRow>) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, ...patch };
        const nextMethodName = "paymentMethodId" in patch ? methodName(next.paymentMethodId) : methodName(r.paymentMethodId);
        if (isStoreCredit(nextMethodName)) {
          const cap = storeCreditCapFor(key);
          const amountNum = Number(next.amount) || 0;
          if (amountNum > cap) {
            next.amount = cap.toFixed(2);
          }
          next.tendered = "";
        }
        return next;
      }),
    );
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { key: crypto.randomUUID(), paymentMethodId: defaultMethodId, amount: remaining > 0 ? remaining.toFixed(2) : "0", tendered: "" },
    ]);
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  }

  function handleSubmit() {
    const payments: PaymentInput[] = rows.map((r) => {
      // `amount` (the amount applied to the sale) is always the exact figure — completeSale
      // requires payments to sum to exactly the re-derived grandTotal, and that check is
      // intentionally untouched. Cash rounding only ever affects the physical change handed
      // back (see the rounding-decision comment near the row rendering below).
      const amount = Math.round((Number(r.amount) || 0) * 100) / 100;
      const cash = isCash(methodName(r.paymentMethodId));
      const tendered = cash && r.tendered ? Math.round(Number(r.tendered) * 100) / 100 : null;
      let change: number | null = null;
      if (cash && tendered !== null) {
        const roundedCashDue = roundToCashIncrement(amount, cashRoundingIncrement);
        change = Math.max(0, roundToCashIncrement(tendered - roundedCashDue, cashRoundingIncrement));
      }
      return {
        paymentMethodId: r.paymentMethodId,
        amount,
        tenderedAmount: tendered,
        changeGiven: change,
        referenceNumber: null,
      };
    });
    onSubmit(payments);
  }

  return (
    <Card className="flex flex-col gap-5 p-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <h2 className="font-heading text-lg font-semibold text-text">Payment</h2>
        <span className="font-heading text-3xl font-bold text-text">
          {currencySymbol}
          {grandTotal.toFixed(2)}
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {rows.map((r) => {
          const cash = isCash(methodName(r.paymentMethodId));
          const storeCredit = isStoreCredit(methodName(r.paymentMethodId));
          const storeCreditCap = storeCredit ? storeCreditCapFor(r.key) : 0;
          const tenderedNum = Number(r.tendered) || 0;
          const amountNum = Number(r.amount) || 0;
          // Cash-rounding decision: the amount applied to the sale (amountNum, and the
          // `amount` sent to completeSale) is always exact — never rounded — so it keeps
          // summing to grandTotal for completeSale's validation. Only the *change handed
          // back* is rounded to the nearest cashRoundingIncrement (e.g. nearest ₱1), which
          // is standard retail cash-rounding practice: round what's physically counted, not
          // the ledger. The resulting few-centavo gap between exact and rounded change is
          // absorbed as ordinary till variance at shift close (see lib/shift.ts's
          // expectedCash, which is driven by the exact Payment.amount, not changeGiven).
          const roundedCashDue = cash ? roundToCashIncrement(amountNum, cashRoundingIncrement) : amountNum;
          const cashRoundingActive = cash && !!cashRoundingIncrement && cashRoundingIncrement > 0;
          const change = cash
            ? Math.max(0, roundToCashIncrement(tenderedNum - roundedCashDue, cashRoundingIncrement))
            : 0;

          return (
            <div key={r.key} className="flex flex-col gap-3 rounded-lg border border-border bg-bg p-4">
              {/* Large payment-method tabs — fewer/bigger clicks beats a cramped dropdown at the register. */}
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Payment method">
                {availableMethods.map((m) => {
                  const Icon = methodIcon(m.name);
                  const active = r.paymentMethodId === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => updateRow(r.key, { paymentMethodId: m.id })}
                      className={cn(
                        "flex min-h-14 min-w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 px-4 py-2 text-xs font-semibold transition-colors duration-150",
                        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-surface text-text-muted hover:bg-bg",
                      )}
                    >
                      <Icon className="h-6 w-6" />
                      {m.name}
                    </button>
                  );
                })}

                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(r.key)}
                    aria-label="Remove this payment row"
                    className="ml-auto flex h-11 w-11 cursor-pointer items-center justify-center rounded-md border border-danger-border text-danger transition-colors duration-150 hover:bg-danger-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm font-medium text-text-muted">
                  Amount
                  <input
                    type="number"
                    min={0}
                    max={storeCredit ? storeCreditCap : undefined}
                    step="0.01"
                    value={r.amount}
                    onChange={(e) => updateRow(r.key, { amount: e.target.value })}
                    className={numberFieldClasses}
                  />
                </label>

                {storeCredit && (
                  <span className="text-xs font-medium text-text-muted">
                    Available: {currencySymbol}
                    {storeCreditCap.toFixed(2)}
                  </span>
                )}

                {cash && (
                  <label className="flex items-center gap-2 text-sm font-medium text-text-muted">
                    Tendered
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={r.tendered}
                      onChange={(e) => updateRow(r.key, { tendered: e.target.value })}
                      className={numberFieldClasses}
                    />
                  </label>
                )}

                {cash && r.tendered && (
                  <span className="text-sm font-semibold text-success">
                    Change: {currencySymbol}
                    {change.toFixed(2)}
                  </span>
                )}
              </div>

              {cashRoundingActive && (
                <p className="text-xs text-text-muted">
                  Exact total: {currencySymbol}
                  {amountNum.toFixed(2)} · Rounded cash due (nearest {currencySymbol}
                  {cashRoundingIncrement!.toFixed(2)}): {currencySymbol}
                  {roundedCashDue.toFixed(2)}
                </p>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={addRow}
          className={cn(
            "flex min-h-11 w-fit cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium text-text-muted",
            "transition-colors duration-150 hover:bg-bg hover:text-text",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          )}
        >
          + Split payment
        </button>
      </div>

      <div
        className={cn(
          "rounded-md border px-4 py-2.5 text-sm font-medium",
          balanced
            ? "border-success-border bg-success-bg text-success"
            : "border-warning-border bg-warning-bg text-warning",
        )}
      >
        {balanced
          ? "Payments cover the full total."
          : remaining > 0
            ? `${currencySymbol}${remaining.toFixed(2)} still remaining.`
            : `${currencySymbol}${Math.abs(remaining).toFixed(2)} over the total.`}
      </div>

      <div className="flex justify-end gap-3 border-t border-border pt-4">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          Back to cart
        </Button>
        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={handleSubmit}
          disabled={!balanced || submitting}
          loading={submitting}
          className="min-w-48 text-base"
        >
          {submitting ? "Completing…" : "Complete sale"}
        </Button>
      </div>
    </Card>
  );
}
