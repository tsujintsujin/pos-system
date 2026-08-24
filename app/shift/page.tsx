import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getActiveShift, getShiftSummary } from "@/lib/shift";
import { prisma } from "@/lib/prisma";
import { openShift, closeShift, recordCashMovement } from "@/app/actions/shifts";
import IdleLockGuard from "@/app/components/IdleLockGuard";
import Banner from "@/app/components/Banner";
import PageHeader from "@/app/components/ui/PageHeader";
import Card from "@/app/components/ui/Card";
import StatCard from "@/app/components/ui/StatCard";
import Input from "@/app/components/ui/Input";
import Select from "@/app/components/ui/Select";
import Button, { LinkButton } from "@/app/components/ui/Button";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/app/components/ui/Table";

export default async function ShiftPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const shift = await getActiveShift(user.id);
  const openEntry = await prisma.timeClockEntry.findFirst({
    where: { userId: user.id, clockOut: null },
    orderBy: { clockIn: "desc" },
  });

  const summary = shift ? await getShiftSummary(prisma, shift.id) : null;

  return (
    <IdleLockGuard>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
        <PageHeader
          title="Shift & cash drawer"
          subtitle={
            <>
              {user.name} ·{" "}
              {openEntry ? (
                <span className="text-success">Clocked in since {openEntry.clockIn.toLocaleTimeString()}</span>
              ) : (
                <span className="text-text-muted">Clocked out</span>
              )}
            </>
          }
          backHref="/dashboard"
          backLabel="Dashboard"
        />

        <Banner error={error} success={success} />

        {!shift && (
          <Card className="flex flex-col gap-3">
            <div>
              <h2 className="font-heading font-medium text-text">Open shift</h2>
              <p className="text-sm text-text-muted">
                A shift must be open before the Sales Terminal can process a sale.
              </p>
            </div>
            <form action={openShift} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm text-text-muted">
                Opening float (cash starting amount)
                <Input type="number" name="openingFloat" min={0} step="0.01" defaultValue={0} required />
              </label>
              <Button type="submit" className="self-start">
                Open shift
              </Button>
            </form>
          </Card>
        )}

        {shift && summary && (
          <>
            <section className="flex flex-col gap-3">
              <h2 className="font-heading font-medium text-text">
                Shift #{shift.id} — X-report (in progress)
              </h2>
              <p className="text-sm text-text-muted">Opened {shift.openedAt.toLocaleString()}</p>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard label="Opening float" value={`₱${summary.openingFloat.toFixed(2)}`} />
                <StatCard label="Completed sales" value={summary.salesCount} />
                <StatCard
                  label="Expected cash in drawer"
                  value={`₱${summary.expectedCash.toFixed(2)}`}
                  tone="success"
                />
              </div>

              <Card className="p-0">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Line item</TableHeaderCell>
                      <TableHeaderCell className="text-right">Amount</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
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
            </section>

            <Card className="flex flex-col gap-3">
              <h2 className="font-heading font-medium text-text">Record cash movement</h2>
              <form action={recordCashMovement} className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-sm text-text-muted">
                  Type
                  <Select name="type" required className="w-40">
                    <option value="PAID_IN">Paid in</option>
                    <option value="PAID_OUT">Paid out</option>
                    <option value="SAFE_DROP">Safe drop</option>
                  </Select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-text-muted">
                  Amount
                  <Input type="number" name="amount" min={0.01} step="0.01" required className="w-32" />
                </label>
                <label className="flex flex-1 flex-col gap-1 text-sm text-text-muted">
                  Reason
                  <Input type="text" name="reason" />
                </label>
                <Button type="submit" variant="secondary">
                  Record
                </Button>
              </form>
            </Card>

            <Card className="flex flex-col gap-3 border-danger-border bg-danger-bg">
              <h2 className="font-heading font-medium text-text">Close shift</h2>
              <form action={closeShift} className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-sm text-text-muted">
                  Counted cash in drawer
                  <Input type="number" name="closingCount" min={0} step="0.01" required className="w-40" />
                </label>
                <Button type="submit" variant="danger">
                  Close shift &amp; generate Z-report
                </Button>
              </form>
            </Card>

            <LinkButton href="/sales" variant="ghost" className="self-start">
              Go to Sales Terminal
            </LinkButton>
          </>
        )}
      </div>
    </IdleLockGuard>
  );
}
