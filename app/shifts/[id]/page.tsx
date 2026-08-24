import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getShiftSummary } from "@/lib/shift";
import { prisma } from "@/lib/prisma";
import IdleLockGuard from "@/app/components/IdleLockGuard";
import PageHeader from "@/app/components/ui/PageHeader";
import Card from "@/app/components/ui/Card";
import StatCard, { type StatCardProps } from "@/app/components/ui/StatCard";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/app/components/ui/Table";

/** Z-report: the closing report for a specific shift (usually just-closed, but any shift
 * id can be viewed after the fact — same summary math as the X-report in /shift). */
export default async function ShiftReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const shiftId = Number(id);
  if (Number.isNaN(shiftId)) notFound();

  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { cashier: { select: { name: true } }, location: { select: { name: true } } },
  });
  if (!shift) notFound();

  const summary = await getShiftSummary(prisma, shiftId);
  if (!summary) notFound();

  const isClosed = shift.closedAt !== null;
  const variance = isClosed ? Number(shift.variance) : null;
  // Preserve original logic exactly: 0 = neutral, >0 = success (green), <0 = danger (red).
  const varianceTone: StatCardProps["tone"] =
    variance === null || variance === 0 ? "neutral" : variance > 0 ? "success" : "danger";

  return (
    <IdleLockGuard>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
        <PageHeader
          title={`Shift #${shift.id} — ${isClosed ? "Z-report" : "X-report"}`}
          subtitle={
            <>
              {shift.location.name} · Cashier: {shift.cashier.name}
            </>
          }
          backHref="/shift"
          backLabel="Shift"
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Opening float" value={`₱${summary.openingFloat.toFixed(2)}`} />
          <StatCard label="Completed sales" value={summary.salesCount} />
          <StatCard label="Expected cash" value={`₱${summary.expectedCash.toFixed(2)}`} />
          {isClosed && (
            <>
              <StatCard label="Counted cash" value={`₱${Number(shift.closingCount).toFixed(2)}`} />
              <StatCard
                label="Variance"
                value={`${variance !== null && variance > 0 ? "+" : ""}₱${Number(shift.variance).toFixed(2)}`}
                tone={varianceTone}
              />
            </>
          )}
        </div>

        <Card className="p-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Line item</TableHeaderCell>
                <TableHeaderCell className="text-right">Value</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>Opened</TableCell>
                <TableCell className="text-right">{shift.openedAt.toLocaleString()}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Closed</TableCell>
                <TableCell className="text-right">
                  {shift.closedAt ? shift.closedAt.toLocaleString() : "Still open"}
                </TableCell>
              </TableRow>
              {Object.entries(summary.salesByMethod).map(([method, amount]) => (
                <TableRow key={method}>
                  <TableCell>{method} sales</TableCell>
                  <TableCell className="text-right">₱{amount.toFixed(2)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="font-medium text-text">Gross sales total</TableCell>
                <TableCell className="text-right font-medium text-text">
                  ₱{summary.grossSalesTotal.toFixed(2)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Paid in</TableCell>
                <TableCell className="text-right">₱{summary.paidIn.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Paid out</TableCell>
                <TableCell className="text-right">-₱{summary.paidOut.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Safe drops</TableCell>
                <TableCell className="text-right">-₱{summary.safeDrop.toFixed(2)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      </div>
    </IdleLockGuard>
  );
}
