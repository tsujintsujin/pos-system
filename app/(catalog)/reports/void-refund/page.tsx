import { redirect } from "next/navigation";
import Link from "next/link";
import { requireRole, getCurrentUser } from "@/lib/auth";
import { parseDateRange, getVoidRefundReport, getCancellableSales } from "@/lib/reports";
import ReportDateFilter from "@/app/components/ReportDateFilter";
import Banner from "@/app/components/Banner";
import CancelReceiptForm from "@/app/components/CancelReceiptForm";
import PageHeader from "@/app/components/ui/PageHeader";
import Card from "@/app/components/ui/Card";
import StatCard from "@/app/components/ui/StatCard";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/app/components/ui/Table";

export default async function VoidRefundReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; error?: string; success?: string }>;
}) {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    redirect(`/dashboard?error=${encodeURIComponent(gate.message)}`);
  }

  const sp = await searchParams;
  const range = parseDateRange(sp);
  const [report, cancellableSales, user] = await Promise.all([
    getVoidRefundReport(range),
    getCancellableSales(range),
    getCurrentUser(),
  ]);
  const canCancelReceipts = Boolean(user?.role.canVoidAfterCompletion);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Void / refund report" backHref="/reports" backLabel="Reports" />

      <Banner error={sp.error} success={sp.success} />

      <ReportDateFilter
        fromStr={range.fromStr}
        toStr={range.toStr}
        csvHref={`/api/reports/void-refund/csv?from=${range.fromStr}&to=${range.toStr}`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Voided total" value={`₱${report.voidTotal.toFixed(2)}`} tone={report.voidTotal > 0 ? "danger" : "neutral"} />
        <StatCard label="Refunded total" value={`₱${report.refundTotal.toFixed(2)}`} tone={report.refundTotal > 0 ? "warning" : "neutral"} />
      </div>

      <Card className="p-0">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-heading text-sm font-semibold text-text">Completed sales</h2>
          <p className="mt-1 text-xs text-text-muted">
            Cancelling a receipt here marks it VOIDED and restocks its items — it does not
            process a refund. For a customer refund, use the Returns flow instead.
          </p>
        </div>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Receipt #</TableHeaderCell>
              <TableHeaderCell>Cashier</TableHeaderCell>
              <TableHeaderCell className="text-right">Amount</TableHeaderCell>
              <TableHeaderCell>Completed at</TableHeaderCell>
              {canCancelReceipts && <TableHeaderCell className="text-right">Action</TableHeaderCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {cancellableSales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canCancelReceipts ? 5 : 4} className="py-6 text-center text-text-muted">
                  No completed sales in this range.
                </TableCell>
              </TableRow>
            ) : (
              cancellableSales.map((s) => (
                <TableRow key={s.saleId}>
                  <TableCell>{s.receiptNumber}</TableCell>
                  <TableCell>{s.cashierName}</TableCell>
                  <TableCell className="text-right font-medium">₱{s.grandTotal.toFixed(2)}</TableCell>
                  <TableCell className="text-text-muted">
                    {s.completedAt ? new Date(s.completedAt).toLocaleString() : "—"}
                  </TableCell>
                  {canCancelReceipts && (
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        <CancelReceiptForm saleId={s.saleId} receiptNumber={s.receiptNumber} />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Card className="p-0">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-heading text-sm font-semibold text-text">Voided sales (pre-completion)</h2>
        </div>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Receipt #</TableHeaderCell>
              <TableHeaderCell>Cashier</TableHeaderCell>
              <TableHeaderCell className="text-right">Amount</TableHeaderCell>
              <TableHeaderCell>Voided at</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {report.voids.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-text-muted">
                  No voided sales in this range.
                </TableCell>
              </TableRow>
            ) : (
              report.voids.map((v) => (
                <TableRow key={v.saleId}>
                  <TableCell>{v.receiptNumber}</TableCell>
                  <TableCell>{v.cashierName}</TableCell>
                  <TableCell className="text-right font-medium">₱{v.grandTotal.toFixed(2)}</TableCell>
                  <TableCell className="text-text-muted">{new Date(v.createdAt).toLocaleString()}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Card className="p-0">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-heading text-sm font-semibold text-text">Returns (post-completion refunds)</h2>
        </div>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Original receipt #</TableHeaderCell>
              <TableHeaderCell>Processed by</TableHeaderCell>
              <TableHeaderCell className="text-right">Refunded</TableHeaderCell>
              <TableHeaderCell>Reason</TableHeaderCell>
              <TableHeaderCell>Date</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {report.refunds.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-text-muted">
                  No returns in this range.
                </TableCell>
              </TableRow>
            ) : (
              report.refunds.map((r) => (
                <TableRow key={r.returnId}>
                  <TableCell>
                    <Link
                      href="/returns"
                      className="cursor-pointer text-text transition-colors duration-150 hover:text-primary hover:underline"
                    >
                      {r.originalReceiptNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{r.processedByName}</TableCell>
                  <TableCell className="text-right font-medium">₱{r.totalRefunded.toFixed(2)}</TableCell>
                  <TableCell className="text-text-muted">{r.reason ?? "—"}</TableCell>
                  <TableCell className="text-text-muted">{new Date(r.createdAt).toLocaleString()}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
