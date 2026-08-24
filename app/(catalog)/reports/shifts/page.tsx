import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { parseDateRange, getShiftReconciliationReport } from "@/lib/reports";
import ReportDateFilter from "@/app/components/ReportDateFilter";
import PageHeader from "@/app/components/ui/PageHeader";
import Card from "@/app/components/ui/Card";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/app/components/ui/Table";
import { WarningTriangleIcon } from "@/app/components/ui/icons";

export default async function ShiftReconciliationReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    redirect(`/dashboard?error=${encodeURIComponent(gate.message)}`);
  }

  const sp = await searchParams;
  const range = parseDateRange(sp);
  const rows = await getShiftReconciliationReport(range);

  const flaggedCount = rows.filter((r) => r.variance !== null && r.variance !== 0).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Shift reconciliation"
        subtitle="A list across shifts, filtered by when each shift opened — click a shift to view its full X/Z-report detail."
        backHref="/reports"
        backLabel="Reports"
      />

      <ReportDateFilter
        fromStr={range.fromStr}
        toStr={range.toStr}
        csvHref={`/api/reports/shifts/csv?from=${range.fromStr}&to=${range.toStr}`}
      />

      {flaggedCount > 0 && (
        <p className="flex items-center gap-2 rounded-md bg-warning-bg px-4 py-3 text-sm text-warning">
          <WarningTriangleIcon className="h-4 w-4 shrink-0" />
          {flaggedCount} shift{flaggedCount === 1 ? "" : "s"} in this range closed with nonzero variance.
        </p>
      )}

      <Card className="p-0">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Shift</TableHeaderCell>
              <TableHeaderCell>Cashier</TableHeaderCell>
              <TableHeaderCell>Location</TableHeaderCell>
              <TableHeaderCell>Opened</TableHeaderCell>
              <TableHeaderCell>Closed</TableHeaderCell>
              <TableHeaderCell className="text-right">Expected cash</TableHeaderCell>
              <TableHeaderCell className="text-right">Counted</TableHeaderCell>
              <TableHeaderCell className="text-right">Variance</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-6 text-center text-text-muted">
                  No shifts opened in this range.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((s) => {
                // Preserve original logic exactly: 0 = neutral, >0 = success (green), <0 = danger (red).
                // Same threshold logic as /shifts/[id]'s Z-report StatCard tone.
                const varianceClass =
                  s.variance === null
                    ? "text-text-muted"
                    : s.variance === 0
                      ? "text-text"
                      : s.variance > 0
                        ? "text-success"
                        : "text-danger";
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <a
                        href={`/shifts/${s.id}`}
                        className="cursor-pointer font-medium text-text transition-colors duration-150 hover:text-primary hover:underline"
                      >
                        #{s.id}
                      </a>
                    </TableCell>
                    <TableCell>{s.cashierName}</TableCell>
                    <TableCell className="text-text-muted">{s.locationName}</TableCell>
                    <TableCell className="text-text-muted">{new Date(s.openedAt).toLocaleString()}</TableCell>
                    <TableCell className="text-text-muted">
                      {s.closedAt ? new Date(s.closedAt).toLocaleString() : "Still open"}
                    </TableCell>
                    <TableCell className="text-right">
                      {s.expectedCash !== null ? `₱${s.expectedCash.toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {s.closingCount !== null ? `₱${s.closingCount.toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${varianceClass}`}>
                      {s.variance === null ? "—" : `${s.variance > 0 ? "+" : ""}₱${s.variance.toFixed(2)}`}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
