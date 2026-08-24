"use client";

import { useMemo, useState } from "react";
import type { SaleLookupResult } from "@/app/api/returns/lookup/route";
import { completeReturn } from "@/app/actions/returns";
import { MANAGER_APPROVAL_THRESHOLD } from "@/lib/return-constants";
import { apiPath } from "@/lib/base-path";
import type { RefundMethod } from "@/app/generated/prisma/enums";
import ManagerPinModal from "@/app/components/returns/ManagerPinModal";
import ReturnReceipt from "@/app/components/returns/ReturnReceipt";
import Button, { LinkButton } from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Textarea from "@/app/components/ui/Textarea";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/app/components/ui/Table";
import {
  CashIcon,
  CheckCircleIcon,
  SearchIcon,
  WalletIcon,
  WarningTriangleIcon,
} from "@/app/components/ui/icons";
import { cn } from "@/lib/cn";

type Stage = "LOOKUP" | "FORM" | "RECEIPT";

interface LineSelection {
  quantityReturned: string; // kept as string for the input; parsed on submit
  restocked: boolean;
}

const REFUND_METHOD_LABELS: Record<RefundMethod, string> = {
  ORIGINAL_PAYMENT: "Original payment method",
  CASH: "Cash",
  STORE_CREDIT: "Store credit",
};

function methodIcon(method: RefundMethod) {
  if (method === "CASH") return CashIcon;
  if (method === "STORE_CREDIT") return WalletIcon;
  return CheckCircleIcon;
}

export default function ReturnsTerminal({
  cashierName,
  canApproveRefund,
}: {
  cashierName: string;
  canApproveRefund: boolean;
}) {
  const [stage, setStage] = useState<Stage>("LOOKUP");
  const [receiptNumberInput, setReceiptNumberInput] = useState("");
  const [sale, setSale] = useState<SaleLookupResult | null>(null);
  const [selections, setSelections] = useState<Record<number, LineSelection>>({});
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("ORIGINAL_PAYMENT");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [approval, setApproval] = useState<{ managerName: string; pin: string } | null>(null);
  const [completedReturnId, setCompletedReturnId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const totalRefund = useMemo(() => {
    if (!sale) return 0;
    let total = 0;
    for (const line of sale.lines) {
      const sel = selections[line.saleLineItemId];
      const qty = Number(sel?.quantityReturned ?? 0);
      if (!qty || qty <= 0) continue;
      total += (line.lineTotal / line.quantity) * qty;
    }
    return Math.round((total + Number.EPSILON) * 100) / 100;
  }, [sale, selections]);

  const needsManagerApproval = totalRefund > MANAGER_APPROVAL_THRESHOLD && !canApproveRefund;

  function resetAll() {
    setStage("LOOKUP");
    setReceiptNumberInput("");
    setSale(null);
    setSelections({});
    setRefundMethod("ORIGINAL_PAYMENT");
    setReason("");
    setError(null);
    setApproval(null);
    setCompletedReturnId(null);
  }

  async function handleLookup() {
    const receiptNumber = receiptNumberInput.trim();
    if (!receiptNumber) {
      setError("Enter a receipt number");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiPath(`/api/returns/lookup?receiptNumber=${encodeURIComponent(receiptNumber)}`));
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not find that sale");
        return;
      }
      setSale(data as SaleLookupResult);
      setSelections({});
      setRefundMethod(data.customerId ? "ORIGINAL_PAYMENT" : "ORIGINAL_PAYMENT");
      setStage("FORM");
    } catch {
      setError("Lookup failed — try again");
    } finally {
      setLoading(false);
    }
  }

  function updateSelection(saleLineItemId: number, patch: Partial<LineSelection>) {
    setSelections((prev) => ({
      ...prev,
      [saleLineItemId]: {
        quantityReturned: prev[saleLineItemId]?.quantityReturned ?? "0",
        restocked: prev[saleLineItemId]?.restocked ?? false,
        ...patch,
      },
    }));
  }

  function handleSubmitClick() {
    setError(null);

    if (!sale) return;
    const lines = Object.entries(selections)
      .map(([id, sel]) => ({ saleLineItemId: Number(id), quantityReturned: Number(sel.quantityReturned) || 0, restocked: sel.restocked }))
      .filter((l) => l.quantityReturned > 0);

    if (lines.length === 0) {
      setError("Select at least one item and quantity to return");
      return;
    }
    if (totalRefund <= 0) {
      setError("Refund amount must be greater than zero");
      return;
    }
    if (refundMethod === "STORE_CREDIT" && !sale.customerId) {
      setError("Store credit requires a customer on the original sale");
      return;
    }

    if (needsManagerApproval && !approval) {
      setShowPinModal(true);
      return;
    }

    void submitReturn(lines);
  }

  async function submitReturn(lines: { saleLineItemId: number; quantityReturned: number; restocked: boolean }[]) {
    if (!sale) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await completeReturn({
        saleId: sale.id,
        reason,
        refundMethod,
        lines,
        managerPin: approval?.pin ?? null,
      });
      setCompletedReturnId(result.id);
      setStage("RECEIPT");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not complete this return");
    } finally {
      setSubmitting(false);
    }
  }

  function handlePinApproved(managerName: string, pin: string) {
    setApproval({ managerName, pin });
    setShowPinModal(false);
    // Re-run submit now that approval is in place.
    if (!sale) return;
    const lines = Object.entries(selections)
      .map(([id, sel]) => ({ saleLineItemId: Number(id), quantityReturned: Number(sel.quantityReturned) || 0, restocked: sel.restocked }))
      .filter((l) => l.quantityReturned > 0);
    void submitReturn(lines);
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-text">Returns / Refunds</h1>
          <p className="text-sm text-text-muted">Cashier: {cashierName}</p>
        </div>
        <div className="flex items-center gap-2">
          <LinkButton href="/dashboard" variant="ghost" size="sm">
            Dashboard
          </LinkButton>
          <LinkButton href="/sales" variant="secondary" size="sm">
            Sales Terminal
          </LinkButton>
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger"
        >
          {error}
        </p>
      )}

      {stage === "LOOKUP" && (
        <Card className="flex flex-col gap-3 p-6">
          <h2 className="font-heading font-medium text-text">Look up original sale</h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" />
              <Input
                type="text"
                value={receiptNumberInput}
                onChange={(e) => setReceiptNumberInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                placeholder="Receipt number, e.g. L1-R1-000001"
                autoFocus
                className="min-h-14 pl-10 text-base"
              />
            </div>
            <Button
              type="button"
              onClick={handleLookup}
              disabled={loading}
              loading={loading}
              className="min-h-14 px-6 text-base"
            >
              {loading ? "Searching…" : "Search"}
            </Button>
          </div>
        </Card>
      )}

      {stage === "FORM" && sale && (
        <div className="flex flex-col gap-6">
          <Card className="p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-heading font-medium text-text">Sale {sale.receiptNumber}</h2>
              <button
                type="button"
                onClick={resetAll}
                className="cursor-pointer text-xs font-medium text-text-muted transition-colors duration-150 hover:text-primary"
              >
                ← New lookup
              </button>
            </div>
            <dl className="grid grid-cols-2 gap-y-2 text-sm text-text-muted sm:grid-cols-4">
              <dt>Status</dt>
              <dd className="text-text">{sale.status.replace("_", " ")}</dd>
              <dt>Cashier</dt>
              <dd className="text-text">{sale.cashierName}</dd>
              <dt>Customer</dt>
              <dd className="text-text">{sale.customerName ?? "— none —"}</dd>
              <dt>Grand total</dt>
              <dd className="text-text">₱{sale.grandTotal.toFixed(2)}</dd>
            </dl>
          </Card>

          <Table>
            <TableHead>
              <TableRow className="hover:bg-transparent">
                <TableHeaderCell>Item</TableHeaderCell>
                <TableHeaderCell className="text-right">Sold qty</TableHeaderCell>
                <TableHeaderCell className="text-right">Already returned</TableHeaderCell>
                <TableHeaderCell className="text-right">Returnable</TableHeaderCell>
                <TableHeaderCell className="text-right">Return qty</TableHeaderCell>
                <TableHeaderCell className="text-center">Restock</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sale.lines.map((line) => {
                const sel = selections[line.saleLineItemId];
                const hasQty = Number(sel?.quantityReturned) > 0;
                const restocked = sel?.restocked ?? false;
                return (
                  <TableRow key={line.saleLineItemId}>
                    <TableCell>
                      <div className="font-medium text-text">{line.name}</div>
                      <div className="text-xs text-text-muted">{line.sku}</div>
                    </TableCell>
                    <TableCell className="text-right">{line.quantity}</TableCell>
                    <TableCell className="text-right text-text-muted">{line.alreadyReturned}</TableCell>
                    <TableCell className="text-right">{line.returnable}</TableCell>
                    <TableCell className="text-right">
                      <input
                        type="number"
                        min={0}
                        max={line.returnable}
                        step="1"
                        value={sel?.quantityReturned ?? ""}
                        disabled={line.returnable <= 0}
                        onChange={(e) => updateSelection(line.saleLineItemId, { quantityReturned: e.target.value })}
                        aria-label={`Return quantity for ${line.name}`}
                        className={cn(
                          "min-h-11 w-24 rounded-md border border-border bg-surface px-2 py-2 text-right text-sm text-text",
                          "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                          "transition-colors duration-200 disabled:cursor-not-allowed disabled:bg-bg disabled:opacity-60",
                        )}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={restocked}
                        aria-label={`Restock ${line.name} on return`}
                        disabled={!hasQty}
                        onClick={() => updateSelection(line.saleLineItemId, { restocked: !restocked })}
                        className={cn(
                          "inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors duration-150",
                          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                          "disabled:cursor-not-allowed disabled:opacity-50",
                          restocked
                            ? "border-success-border bg-success-bg text-success"
                            : "border-border bg-surface text-text-muted hover:bg-bg",
                        )}
                      >
                        <CheckCircleIcon className="h-4 w-4" />
                        {restocked ? "Restocking" : "No restock"}
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <Card className="flex flex-col gap-5 p-6">
            <div>
              <span className="mb-2 block text-sm font-medium text-text-muted">Refund method</span>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Refund method">
                {(["ORIGINAL_PAYMENT", "CASH", "STORE_CREDIT"] as RefundMethod[]).map((method) => {
                  if (method === "STORE_CREDIT" && !sale.customerId) return null;
                  const Icon = methodIcon(method);
                  const active = refundMethod === method;
                  return (
                    <button
                      key={method}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setRefundMethod(method)}
                      className={cn(
                        "flex min-h-14 min-w-32 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 px-4 py-2 text-xs font-semibold transition-colors duration-150",
                        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-surface text-text-muted hover:bg-bg",
                      )}
                    >
                      <Icon className="h-6 w-6" />
                      {REFUND_METHOD_LABELS[method]}
                    </button>
                  );
                })}
              </div>
              {!sale.customerId && (
                <span className="mt-2 block text-xs text-text-muted">
                  Store credit is unavailable — this sale has no customer attached.
                </span>
              )}
            </div>

            <label className="flex flex-col gap-1.5 text-sm font-medium text-text-muted">
              Reason
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Why is this being returned?"
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
              <div>
                <div className="text-xs text-text-muted">Total refund</div>
                <div className="font-heading text-3xl font-bold text-text">₱{totalRefund.toFixed(2)}</div>
                {needsManagerApproval && !approval && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-warning">
                    <WarningTriangleIcon className="h-4 w-4" />
                    Over ₱{MANAGER_APPROVAL_THRESHOLD.toFixed(2)} — manager approval required
                  </div>
                )}
                {approval && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-success">
                    <CheckCircleIcon className="h-4 w-4" />
                    Approved by {approval.managerName}
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="primary"
                onClick={handleSubmitClick}
                disabled={submitting}
                loading={submitting}
                className="min-w-56 text-base"
              >
                {submitting ? "Processing…" : "Complete return"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {stage === "RECEIPT" && completedReturnId && (
        <ReturnReceipt returnId={completedReturnId} onNewReturn={resetAll} />
      )}

      {showPinModal && <ManagerPinModal onApproved={handlePinApproved} onCancel={() => setShowPinModal(false)} />}
    </div>
  );
}
