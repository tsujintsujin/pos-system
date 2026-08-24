"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { computeCart } from "@/lib/sales-calc";
import type { DiscountInput, TaxableLine } from "@/lib/sales-calc";
import { completeSale, holdSale, voidParkedSale } from "@/app/actions/sales";
import type { CartLineInput, PaymentInput } from "@/app/actions/sales";
import type { SearchResultItem } from "@/app/api/sales/search/route";
import type { ParkedSaleDetail } from "@/app/api/sales/parked/[id]/route";
import ProductSearch from "@/app/components/sales/ProductSearch";
import ProductGrid from "@/app/components/sales/ProductGrid";
import CartTable from "@/app/components/sales/CartTable";
import DiscountControl from "@/app/components/sales/DiscountControl";
import ParkedSalesPanel from "@/app/components/sales/ParkedSalesPanel";
import PaymentPanel from "@/app/components/sales/PaymentPanel";
import Receipt from "@/app/components/sales/Receipt";
import CustomerPicker from "@/app/components/sales/CustomerPicker";
import type { SelectedCustomer } from "@/app/components/sales/CustomerPicker";
import { apiPath } from "@/lib/base-path";
import Button from "@/app/components/ui/Button";
import Badge from "@/app/components/ui/Badge";
import { CartIcon, ChevronLeftIcon, ReturnArrowIcon } from "@/app/components/ui/icons";
import { cn } from "@/lib/cn";

type Stage = "CART" | "PAYMENT" | "RECEIPT";

interface PaymentMethodOption {
  id: number;
  name: string;
}

export interface CartDiscountOption {
  id: number;
  name: string;
  type: "PERCENTAGE" | "FIXED";
  value: number;
}

/**
 * Cart-building state lives entirely client-side (fast, no round trips per qty tweak).
 * The server is only hit for: product search, hold/park, resume (loading a parked sale),
 * void, and completion. See app/actions/sales.ts for the hold/resume/complete design and
 * app/api/sales/* route handlers for search/parked-list/parked-detail/receipt reads.
 */
export default function SalesTerminal({
  cashierName,
  locationName,
  currencySymbol,
  cashRoundingIncrement,
  receiptLogoUrl,
  receiptFooterText,
  paymentMethods,
  cartDiscounts,
  catalog,
}: {
  cashierName: string;
  locationName: string;
  currencySymbol: string;
  cashRoundingIncrement: number | null;
  receiptLogoUrl: string | null;
  receiptFooterText: string | null;
  paymentMethods: PaymentMethodOption[];
  cartDiscounts: CartDiscountOption[];
  /** Full active-product catalog, fetched once server-side (app/sales/page.tsx) for the
   *  persistent ProductGrid — filtered client-side as the search box is typed. */
  catalog: SearchResultItem[];
}) {
  const [lines, setLines] = useState<TaxableLine[]>([]);
  const [discount, setDiscount] = useState<DiscountInput>(null);
  const [customer, setCustomer] = useState<SelectedCustomer | null>(null);
  const [stage, setStage] = useState<Stage>("CART");
  const [resumingSaleId, setResumingSaleId] = useState<number | null>(null);
  const [parkedPanelOpen, setParkedPanelOpen] = useState(false);
  const [completedSaleId, setCompletedSaleId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [gridQuery, setGridQuery] = useState("");
  // key -> product photo. Threaded separately from the TaxableLine/ComputedLine shape
  // (lib/sales-calc.ts, left untouched) purely so CartTable's row thumbnails have an
  // image to show — populated whenever addItem adds/increments a line.
  const [imageByKey, setImageByKey] = useState<Record<string, string | null>>({});

  const computed = useMemo(() => computeCart(lines, discount), [lines, discount]);

  const addItem = useCallback((item: SearchResultItem) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.key === item.key);
      if (existing) {
        return prev.map((l) => (l.key === item.key ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...prev,
        {
          key: item.key,
          productId: item.productId,
          variantId: item.variantId,
          sku: item.sku,
          name: item.name,
          unitPrice: item.unitPrice,
          quantity: 1,
          taxRatePercentage: item.taxRatePercentage,
          taxIsInclusive: item.taxIsInclusive,
          trackStock: item.trackStock,
        },
      ];
    });
    setImageByKey((prev) => ({ ...prev, [item.key]: item.imageUrl ?? null }));
  }, []);

  function updateQuantity(key: string, quantity: number) {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setLines((prev) => prev.filter((l) => l.key !== key));
      return;
    }
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, quantity } : l)));
  }

  function stepQuantity(key: string, delta: number) {
    setLines((prev) => {
      const line = prev.find((l) => l.key === key);
      if (!line) return prev;
      const next = line.quantity + delta;
      if (!Number.isFinite(next) || next <= 0) {
        return prev.filter((l) => l.key !== key);
      }
      return prev.map((l) => (l.key === key ? { ...l, quantity: next } : l));
    });
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
    setImageByKey((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function resetCart() {
    setLines([]);
    setDiscount(null);
    setCustomer(null);
    setResumingSaleId(null);
    setStage("CART");
    setCompletedSaleId(null);
    setError(null);
    setImageByKey({});
    setGridQuery("");
  }

  function toCartLineInputs(): CartLineInput[] {
    return lines.map((l) => ({
      productId: l.productId,
      variantId: l.variantId,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      taxRatePercentage: l.taxRatePercentage,
      taxIsInclusive: l.taxIsInclusive,
    }));
  }

  function handleHold() {
    if (lines.length === 0) {
      setError("Cart is empty — nothing to park");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await holdSale({
          existingSaleId: resumingSaleId,
          lines: toCartLineInputs(),
          discount,
          customerId: customer?.id ?? null,
        });
        resetCart();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not park this sale");
      }
    });
  }

  async function handleResume(saleId: number) {
    setError(null);
    setParkedPanelOpen(false);
    try {
      const res = await fetch(apiPath(`/api/sales/parked/${saleId}`));
      if (!res.ok) throw new Error("Could not load that parked sale");
      const detail: ParkedSaleDetail = await res.json();
      setLines(detail.lines);
      setImageByKey({});
      setDiscount(detail.discountTotal > 0 ? { type: "FIXED", value: detail.discountTotal } : null);
      setCustomer(detail.customer);
      setResumingSaleId(detail.id);
      setStage("CART");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resume that sale");
    }
  }

  function handleDiscardCart() {
    if (resumingSaleId) {
      const saleId = resumingSaleId;
      startTransition(async () => {
        try {
          await voidParkedSale(saleId);
        } catch {
          // Best-effort — the cart is being discarded either way.
        }
        resetCart();
      });
    } else {
      resetCart();
    }
  }

  function handleCompletePayment(payments: PaymentInput[]) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await completeSale({
          existingSaleId: resumingSaleId,
          lines: toCartLineInputs(),
          discount,
          payments,
          customerId: customer?.id ?? null,
        });
        setCompletedSaleId(result.id);
        setStage("RECEIPT");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not complete this sale");
      }
    });
  }

  const cartDisabled = isPending || lines.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold text-text">Sales Terminal</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
            {locationName} · Cashier: {cashierName}
            {resumingSaleId && (
              <Badge variant="warning">Resuming parked sale #{resumingSaleId}</Badge>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="flex min-h-11 cursor-pointer items-center gap-1 rounded-md px-2 text-sm font-medium text-text-muted transition-colors duration-150 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Dashboard
          </Link>
          <Link
            href="/shift"
            className="flex min-h-11 cursor-pointer items-center px-2 text-sm font-medium text-text-muted transition-colors duration-150 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Shift
          </Link>
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-danger-border bg-danger-bg px-4 py-3 text-sm font-medium text-danger"
        >
          {error}
        </p>
      )}

      {stage === "CART" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
          {/* Left column (~65%): search + tabs + persistent product grid. */}
          <div className="flex min-w-0 flex-col gap-4">
            <ProductSearch onAdd={addItem} onQueryChange={setGridQuery} />

            <div className="flex items-center gap-1 border-b border-border" role="tablist" aria-label="Catalog views">
              <span
                role="tab"
                aria-selected="true"
                className="min-h-11 cursor-default border-b-2 border-primary px-3 py-2 text-sm font-semibold text-primary"
              >
                Products
              </span>
              <button
                type="button"
                role="tab"
                aria-selected="false"
                onClick={() => setParkedPanelOpen(true)}
                className="flex min-h-11 cursor-pointer items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm font-medium text-text-muted transition-colors duration-150 hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <CartIcon className="h-4 w-4" />
                Held carts
              </button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto pb-2 pr-1">
              <ProductGrid products={catalog} query={gridQuery} currencySymbol={currencySymbol} onAdd={addItem} />
            </div>
          </div>

          {/* Right column (~35%): customer, cart items, totals, checkout actions. */}
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm lg:sticky lg:top-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Customer</h2>
              <CustomerPicker customer={customer} onChange={setCustomer} />
            </div>

            <DiscountControl discount={discount} onChange={setDiscount} savedDiscounts={cartDiscounts} />

            <div className="flex min-w-0 flex-col gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Items{lines.length > 0 ? ` (${lines.length})` : ""}
              </h2>
              <div className="max-h-[38vh] overflow-y-auto pr-1">
                <CartTable
                  lines={computed.lines}
                  currencySymbol={currencySymbol}
                  imageByKey={imageByKey}
                  onQuantityChange={updateQuantity}
                  onStepQuantity={stepQuantity}
                  onRemove={removeLine}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1 border-t border-border pt-3 text-sm">
              <div className="flex justify-between text-text-muted">
                <span>Subtotal</span>
                <span>
                  {currencySymbol}
                  {computed.subtotal.toFixed(2)}
                </span>
              </div>
              {computed.discountTotal > 0 && (
                <div className="flex justify-between text-text-muted">
                  <span>Discount</span>
                  <span>
                    -{currencySymbol}
                    {computed.discountTotal.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-text-muted">
                <span>Tax</span>
                <span>
                  {currencySymbol}
                  {computed.taxTotal.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between font-heading text-base font-bold text-text">
                <span>Total</span>
                <span>
                  {currencySymbol}
                  {computed.grandTotal.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleDiscardCart}
                  disabled={cartDisabled}
                  className="flex-1"
                >
                  Discard
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleHold}
                  disabled={cartDisabled}
                  className="flex-1"
                >
                  Save cart
                </Button>
              </div>
              {/* The single most important CTA on the screen — full-width, blue, hard to miss. */}
              <button
                type="button"
                onClick={() => setStage("PAYMENT")}
                disabled={cartDisabled}
                className={cn(
                  "min-h-14 w-full cursor-pointer rounded-xl bg-primary text-lg font-bold text-white shadow-sm",
                  "transition-colors duration-200 hover:bg-primary-hover",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                )}
              >
                Charge {currencySymbol}
                {computed.grandTotal.toFixed(2)}
              </button>
            </div>

            <Link
              href="/returns"
              className="flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium text-text-muted transition-colors duration-150 hover:bg-bg hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <ReturnArrowIcon className="h-4 w-4" />
              Refund / return a sale
            </Link>
          </div>
        </div>
      )}

      {stage === "PAYMENT" && (
        <PaymentPanel
          grandTotal={computed.grandTotal}
          currencySymbol={currencySymbol}
          cashRoundingIncrement={cashRoundingIncrement}
          paymentMethods={paymentMethods}
          customer={customer}
          onCancel={() => setStage("CART")}
          onSubmit={handleCompletePayment}
          submitting={isPending}
        />
      )}

      {stage === "RECEIPT" && completedSaleId && (
        <Receipt
          saleId={completedSaleId}
          currencySymbol={currencySymbol}
          receiptLogoUrl={receiptLogoUrl}
          receiptFooterText={receiptFooterText}
          onNewSale={resetCart}
        />
      )}

      <ParkedSalesPanel open={parkedPanelOpen} onClose={() => setParkedPanelOpen(false)} onResume={handleResume} />
    </div>
  );
}
