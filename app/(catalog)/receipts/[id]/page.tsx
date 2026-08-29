import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Card from "@/app/components/ui/Card";
import PageHeader from "@/app/components/ui/PageHeader";
import Badge, { type BadgeVariant } from "@/app/components/ui/Badge";
import StatCard from "@/app/components/ui/StatCard";
import ProductLink from "@/app/components/ui/ProductLink";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/app/components/ui/Table";
import Receipt from "@/app/components/sales/Receipt";

const DEFAULT_LOCATION_ID = 1;

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  COMPLETED: "success",
  VOIDED: "danger",
  PARKED: "neutral",
};

export default async function ReceiptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (Number.isNaN(id)) notFound();

  const [sale, location] = await Promise.all([
    prisma.sale.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true } },
        cashier: { select: { name: true } },
        location: { select: { name: true } },
        lineItems: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
            variant: { select: { name: true, sku: true } },
          },
          orderBy: { id: "asc" },
        },
        payments: { include: { paymentMethod: { select: { name: true } } } },
      },
    }),
    prisma.location.findUnique({
      where: { id: DEFAULT_LOCATION_ID },
      select: { currencySymbol: true, receiptLogoUrl: true, receiptFooterText: true },
    }),
  ]);
  if (!sale) notFound();

  const symbol = location?.currencySymbol ?? "₱";
  const changeGiven = sale.payments.reduce((sum, p) => sum + (p.changeGiven?.toNumber() ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={sale.receiptNumber}
        subtitle={
          <>
            {sale.completedAt ? new Date(sale.completedAt).toLocaleString() : "Not completed"} ·{" "}
            {sale.location.name} · Cashier: {sale.cashier.name}
          </>
        }
        backHref="/receipts"
        backLabel="Back to receipts"
        actions={<Badge variant={STATUS_VARIANTS[sale.status] ?? "neutral"}>{sale.status}</Badge>}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Subtotal" value={`${symbol}${sale.subtotal.toFixed(2)}`} />
        <StatCard label="Discount" value={`${symbol}${sale.discountTotal.toFixed(2)}`} />
        <StatCard label="Tax" value={`${symbol}${sale.taxTotal.toFixed(2)}`} />
        <StatCard label="Grand total" value={`${symbol}${sale.grandTotal.toFixed(2)}`} tone="success" />
      </div>

      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-text">Line items</h2>
          <span className="text-xs text-text-muted">
            Customer:{" "}
            {sale.customer ? (
              <Link
                href={`/customers/${sale.customer.id}`}
                className="cursor-pointer font-medium text-text transition-colors duration-150 hover:text-primary hover:underline"
              >
                {sale.customer.name}
              </Link>
            ) : (
              "Walk-in"
            )}
          </span>
        </div>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Product</TableHeaderCell>
              <TableHeaderCell>SKU</TableHeaderCell>
              <TableHeaderCell className="text-right">Qty</TableHeaderCell>
              <TableHeaderCell className="text-right">Unit price</TableHeaderCell>
              <TableHeaderCell className="text-right">Discount</TableHeaderCell>
              <TableHeaderCell className="text-right">Tax</TableHeaderCell>
              <TableHeaderCell className="text-right">Line total</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sale.lineItems.map((li) => (
              <TableRow key={li.id}>
                <TableCell>
                  <ProductLink productId={li.product.id}>{li.product.name}</ProductLink>
                  {li.variant && <span className="text-text-muted"> — {li.variant.name}</span>}
                </TableCell>
                <TableCell className="text-text-muted">{li.variant?.sku ?? li.product.sku}</TableCell>
                <TableCell className="text-right">{li.quantity.toNumber()}</TableCell>
                <TableCell className="text-right">
                  {symbol}
                  {li.unitPrice.toFixed(2)}
                </TableCell>
                <TableCell className="text-right text-text-muted">
                  {symbol}
                  {li.discountAmount.toFixed(2)}
                </TableCell>
                <TableCell className="text-right text-text-muted">
                  {symbol}
                  {li.taxAmount.toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {symbol}
                  {li.lineTotal.toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card className="p-0">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-text">Payment</h2>
        </div>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Method</TableHeaderCell>
              <TableHeaderCell>Reference</TableHeaderCell>
              <TableHeaderCell className="text-right">Tendered</TableHeaderCell>
              <TableHeaderCell className="text-right">Change</TableHeaderCell>
              <TableHeaderCell className="text-right">Amount</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sale.payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.paymentMethod.name}</TableCell>
                <TableCell className="text-text-muted">{p.referenceNumber ?? "—"}</TableCell>
                <TableCell className="text-right text-text-muted">
                  {p.tenderedAmount ? `${symbol}${p.tenderedAmount.toFixed(2)}` : "—"}
                </TableCell>
                <TableCell className="text-right text-text-muted">
                  {p.changeGiven ? `${symbol}${p.changeGiven.toFixed(2)}` : "—"}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {symbol}
                  {p.amount.toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {changeGiven > 0 && (
          <p className="border-t border-border px-4 py-2.5 text-right text-sm text-text-muted">
            Total change given: {symbol}
            {changeGiven.toFixed(2)}
          </p>
        )}
      </Card>

      {/* The same printable 80mm receipt the cashier sees at checkout — reused here so
          the print layout (and app/globals.css's #receipt-print-area @media print rule)
          has exactly one implementation. */}
      <Card>
        <h2 className="mb-4 text-sm font-semibold text-text">Printable receipt</h2>
        <Receipt
          saleId={sale.id}
          currencySymbol={symbol}
          receiptLogoUrl={location?.receiptLogoUrl ?? null}
          receiptFooterText={location?.receiptFooterText ?? null}
          showCompletionHeader={false}
        />
      </Card>
    </div>
  );
}
