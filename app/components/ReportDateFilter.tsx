import Card from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Button, { LinkButton } from "@/app/components/ui/Button";
import { DownloadIcon } from "@/app/components/ui/icons";

/**
 * Shared date-range filter for report pages. Plain GET form (no JS needed) — submitting
 * navigates to the same page with ?from=&to= query params, which the report page reads
 * server-side via parseDateRange(). `extraParams` lets a report add its own filters
 * (e.g. inventory history's product/reason selects) alongside the date range.
 */
export default function ReportDateFilter({
  fromStr,
  toStr,
  csvHref,
  children,
}: {
  fromStr: string;
  toStr: string;
  csvHref?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="from" className="text-xs font-medium text-text-muted">
            From
          </label>
          <Input id="from" name="from" type="date" defaultValue={fromStr} className="w-40" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="to" className="text-xs font-medium text-text-muted">
            To
          </label>
          <Input id="to" name="to" type="date" defaultValue={toStr} className="w-40" />
        </div>
        {children}
        <Button type="submit" variant="primary">
          Apply
        </Button>
        {csvHref && (
          <LinkButton href={csvHref} variant="secondary">
            <DownloadIcon className="h-4 w-4" />
            Export CSV
          </LinkButton>
        )}
      </form>
    </Card>
  );
}
