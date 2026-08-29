import Link from "next/link";
import Card from "@/app/components/ui/Card";
import LineChart from "@/app/components/ui/LineChart";
import { cn } from "@/lib/cn";
import {
  getProductSalesSeries,
  PRODUCT_SERIES_RANGES,
  type ProductSeriesRange,
} from "@/lib/reports";

function peso(n: number): string {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Percentage change vs the previous window of equal length; null when there's no baseline. */
function delta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

function DeltaNote({ current, previous, noun }: { current: number; previous: number; noun: string }) {
  const change = delta(current, previous);
  if (change === null) {
    return <span className="text-xs text-text-muted">no {noun} in the previous period</span>;
  }
  const up = change >= 0;
  return (
    <span className={cn("text-xs font-medium", up ? "text-success" : "text-danger")}>
      {up ? "▲" : "▼"} {Math.abs(change).toFixed(1)}% vs previous period
    </span>
  );
}

/**
 * "How is this product doing over the last N days?" on the product detail page.
 *
 * Units sold and revenue share one plot, each scaled to its own maximum (see LineChart's
 * `axis` prop) — they're different units and different magnitudes, and the useful read is
 * whether the two shapes track each other or diverge (a divergence means the average
 * selling price moved, e.g. discounting).
 *
 * The range toggle is plain links (no client JS), the same pattern as DashboardDateFilter.
 */
export default async function ProductPerformanceCard({
  productId,
  range,
}: {
  productId: number;
  range: ProductSeriesRange;
}) {
  const series = await getProductSalesSeries(productId, range);
  const hasSales = series.totalUnits > 0 || series.totalRevenue > 0;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-text">Performance</h2>
          <p className="text-xs text-text-muted">Units sold and revenue over time</p>
        </div>
        <div
          role="group"
          aria-label="Chart range"
          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface p-1"
        >
          {PRODUCT_SERIES_RANGES.map((opt) => {
            const active = opt.key === range;
            return (
              <Link
                key={opt.key}
                href={`/products/${productId}?range=${opt.key}`}
                scroll={false}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "inline-flex min-h-9 cursor-pointer items-center rounded px-3 text-sm font-medium transition-colors duration-150",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  active ? "bg-primary text-white" : "text-text-muted hover:bg-bg hover:text-text",
                )}
              >
                {opt.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="font-heading text-2xl font-semibold text-text">{series.totalUnits}</span>
          <span className="text-xs font-medium text-text-muted">Units sold</span>
          <DeltaNote current={series.totalUnits} previous={series.previousUnits} noun="sales" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-heading text-2xl font-semibold text-text">
            {peso(series.totalRevenue)}
          </span>
          <span className="text-xs font-medium text-text-muted">Revenue</span>
          <DeltaNote current={series.totalRevenue} previous={series.previousRevenue} noun="revenue" />
        </div>
      </div>

      {hasSales ? (
        <LineChart
          labels={series.points.map((p) => p.label)}
          series={[
            {
              label: "Units sold",
              values: series.points.map((p) => p.units),
              color: "var(--color-primary)",
              axis: "left",
              area: true,
              format: (n) => String(n),
            },
            {
              label: "Revenue",
              values: series.points.map((p) => p.revenue),
              color: "var(--color-accent)",
              axis: "right",
              format: peso,
            },
          ]}
        />
      ) : (
        <p className="py-8 text-center text-sm text-text-muted">
          No completed sales of this product in the last {PRODUCT_SERIES_RANGES.find((r) => r.key === range)?.label}.
        </p>
      )}
    </Card>
  );
}
