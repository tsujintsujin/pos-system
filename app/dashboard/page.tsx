import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  parseDateRange,
  getSalesSummaryReport,
  getProductPerformanceReport,
  getSalesByCategory,
  getSalesByHour,
  getReorderAlerts,
  getSlowMovingStock,
  DEFAULT_LOCATION_ID,
  round2,
  storeInstant,
  toStoreDateStr,
  type DateRange,
} from "@/lib/reports";
import PageHeader from "@/app/components/ui/PageHeader";
import Card from "@/app/components/ui/Card";
import { LinkButton } from "@/app/components/ui/Button";
import EmptyState from "@/app/components/ui/EmptyState";
import DashboardStatCard from "@/app/components/ui/DashboardStatCard";
import ProductLink from "@/app/components/ui/ProductLink";
import BarChart from "@/app/components/ui/BarChart";
import LineChart from "@/app/components/ui/LineChart";
import DonutChart from "@/app/components/ui/DonutChart";
import HorizontalBarChart from "@/app/components/ui/HorizontalBarChart";
import DashboardDateFilter, { type DashboardRangeKey } from "@/app/components/DashboardDateFilter";
import {
  WalletIcon,
  CartIcon,
  BoxIcon,
  UserIcon,
  WarningTriangleIcon,
  ReturnArrowIcon,
  ClockIcon,
} from "@/app/components/ui/icons";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatPeso(n: number): string {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Store-local YYYY-MM-DD. Re-exported from lib/reports so the dashboard's quick ranges
 * are anchored to the same wall clock the report queries bucket by. */
const toDateInputStr = toStoreDateStr;

/** Quick-select presets for the stat-card numbers (Today / This week / This month). Kept
 * separate from the always-last-7-days trend data used by the sparklines and bar chart below. */
function resolveQuickRange(key: DashboardRangeKey): DateRange {
  const now = new Date();

  if (key === "today") {
    const fromStr = toDateInputStr(now);
    return {
      from: storeInstant(fromStr, "00:00:00.000"),
      to: storeInstant(fromStr, "23:59:59.999"),
      fromStr,
      toStr: fromStr,
    };
  }

  if (key === "month") {
    const toStr = toDateInputStr(now);
    // First of the current month *on the store's calendar* — deriving it from the
    // already-store-local date string, rather than from server-local Date parts.
    const fromStr = `${toStr.slice(0, 7)}-01`;
    return {
      from: storeInstant(fromStr, "00:00:00.000"),
      to: storeInstant(toStr, "23:59:59.999"),
      fromStr,
      toStr,
    };
  }

  // "week" — rolling last 7 days, same default window as the reports section.
  return parseDateRange({});
}

function parseQuickRangeKey(value: string | undefined): DashboardRangeKey {
  // Default to "month". A week of a real store's data is a handful of transactions,
  // which reads as an empty system on first load even when 90 days sit behind it.
  return value === "today" || value === "week" ? value : "month";
}

/**
 * The window of equal length ending the instant before `range` starts — the baseline for
 * "is this better or worse than before?". Without it a revenue line is just a shape; with
 * it, it's a comparison.
 */
function previousRange(range: DateRange): DateRange {
  const span = range.to.getTime() - range.from.getTime();
  const to = new Date(range.from.getTime() - 1);
  const from = new Date(to.getTime() - span);
  return { from, to, fromStr: toDateInputStr(from), toStr: toDateInputStr(to) };
}

/** Store-local YYYY-MM-DD, `days` after `dateStr`. */
function addStoreDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`); // midday: immune to DST edges
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days, inclusive, covered by a range — how many buckets the trend chart needs.
 * Counted from the store-local date strings, which is what the buckets are keyed by. */
function dayCount(range: DateRange): number {
  const start = Date.parse(`${range.fromStr}T00:00:00Z`);
  const end = Date.parse(`${range.toStr}T00:00:00Z`);
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
}

/** Daily totals for a range, with zero-filled gaps so the line stays continuous. */
function fillDaily(range: DateRange, byDay: { date: string; total: number }[], days: number) {
  const map = new Map(byDay.map((d) => [d.date, d.total]));
  return Array.from({ length: days }, (_, i) => {
    const key = addStoreDays(range.fromStr, i);
    return {
      key,
      label: new Date(`${key}T12:00:00Z`).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }),
      total: round2(map.get(key) ?? 0),
    };
  });
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await getCurrentUser();

  // Belt-and-suspenders: proxy.ts already redirects unauthenticated requests to /login,
  // but the session cookie can still verify (valid JWT) while the underlying user was
  // deactivated/deleted in the DB — getCurrentUser() catches that case.
  if (!user) {
    redirect("/login");
  }

  const sp = await searchParams;
  const rangeKey = parseQuickRangeKey(sp.range);
  const range = resolveQuickRange(rangeKey);
  const prior = previousRange(range);
  const last7 = parseDateRange({}); // fixed last-7-days window for the stat-card sparklines

  const [
    summary,
    priorSummary,
    last7Summary,
    productPerformance,
    categorySales,
    hourly,
    reorderAlerts,
    slowMovers,
    productCount,
    customerCount,
    inventoryRows,
    products,
  ] = await Promise.all([
    getSalesSummaryReport(range),
    getSalesSummaryReport(prior),
    getSalesSummaryReport(last7),
    getProductPerformanceReport(range),
    getSalesByCategory(range),
    getSalesByHour(range),
    getReorderAlerts(6),
    getSlowMovingStock(range, 6),
    prisma.product.count(),
    prisma.customer.count(),
    prisma.inventory.findMany({
      where: { locationId: DEFAULT_LOCATION_ID },
      select: { productId: true, variantId: true, quantityOnHand: true },
    }),
    prisma.product.findMany({
      where: { trackStock: true },
      select: { id: true, reorderThreshold: true },
    }),
  ]);

  // Same low-stock definition as the Inventory page (app/(catalog)/inventory/page.tsx):
  // base-unit quantity on hand at/below the product's reorder threshold, excluding negative
  // (oversold) stock, which is tracked separately there.
  const stockByProduct = new Map(
    inventoryRows.filter((r) => r.variantId === null).map((r) => [r.productId, r.quantityOnHand.toNumber()]),
  );
  const lowStockCount = products.filter((p) => {
    const qty = stockByProduct.get(p.id) ?? 0;
    return qty >= 0 && qty <= p.reorderThreshold;
  }).length;

  const topProducts = productPerformance.byRevenueDesc.slice(0, 6);

  // Fill all 7 days of the window in order (not just days with sales) so the sparklines
  // always show a consistent 7-point shape, with 0s for days with no completed sales,
  // rather than silently compressing/skipping gaps.
  const byDayMap = new Map(last7Summary.byDay.map((d) => [d.date, d]));
  const last7Days: { date: string; label: string; total: number; count: number }[] = [];
  for (let i = 0; i < 7; i++) {
    // Walk store-local calendar dates, not instants — that is what byDay is keyed by.
    const dateStr = addStoreDays(last7.fromStr, i);
    const entry = byDayMap.get(dateStr);
    last7Days.push({
      date: dateStr,
      label: DAY_LABELS[new Date(`${dateStr}T12:00:00Z`).getUTCDay()],
      total: round2(entry?.total ?? 0),
      count: entry?.count ?? 0,
    });
  }

  const salesTrend = last7Days.map((d) => d.total);
  const transactionsTrend = last7Days.map((d) => d.count);

  // Q1 — current vs prior period. Both series are cut to the shorter of the two so the
  // day-N-of-the-period comparison lines up index for index.
  const days = dayCount(range);
  const currentDaily = fillDaily(range, summary.byDay, days);
  const priorDaily = fillDaily(prior, priorSummary.byDay, dayCount(prior));
  const comparableDays = Math.min(currentDaily.length, priorDaily.length);

  const revenueDelta =
    priorSummary.totalSales > 0
      ? ((summary.totalSales - priorSummary.totalSales) / priorSummary.totalSales) * 100
      : null;

  // Q2 — trading hours. Hours with no sales at either end of the day are trimmed so the
  // chart shows the store's actual trading window rather than 24 mostly-empty columns.
  const firstActive = hourly.findIndex((h) => h.count > 0);
  const lastActive = hourly.map((h) => h.count > 0).lastIndexOf(true);
  const tradingHours = firstActive === -1 ? hourly : hourly.slice(firstActive, lastActive + 1);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        subtitle={`Welcome back, ${user.name} — here's how the store is doing.`}
        actions={<DashboardDateFilter active={rangeKey} />}
      />

      <div className="flex flex-wrap gap-2">
        <LinkButton href="/sales" variant="primary">
          <CartIcon className="h-4 w-4" />
          Open Sales Terminal
        </LinkButton>
        <LinkButton href="/returns" variant="secondary">
          <ReturnArrowIcon className="h-4 w-4" />
          Returns
        </LinkButton>
        <LinkButton href="/shift" variant="secondary">
          <ClockIcon className="h-4 w-4" />
          Shift
        </LinkButton>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <DashboardStatCard
          label="Total sales"
          value={formatPeso(summary.totalSales)}
          icon={WalletIcon}
          tone="primary"
          trend={salesTrend}
        />
        <DashboardStatCard
          label="Transactions"
          value={summary.transactionCount}
          icon={CartIcon}
          tone="info"
          trend={transactionsTrend}
        />
        <DashboardStatCard
          label="Total products"
          value={productCount}
          icon={BoxIcon}
          tone="success"
        />
        <DashboardStatCard
          label="Total customers"
          value={customerCount}
          icon={UserIcon}
          tone="info"
        />
        <DashboardStatCard
          label="Low stock"
          value={lowStockCount}
          icon={WarningTriangleIcon}
          tone={lowStockCount > 0 ? "warning" : "success"}
        />
      </div>

      {/* Q1 — Is revenue up or down versus the same stretch of time before this? */}
      <ChartCard
        title="Revenue vs previous period"
        question="Is revenue up or down versus the same stretch of time before this?"
        note={
          revenueDelta === null ? (
            <span className="text-text-muted">no revenue in the previous period</span>
          ) : (
            <span className={revenueDelta >= 0 ? "text-success" : "text-danger"}>
              {revenueDelta >= 0 ? "▲" : "▼"} {Math.abs(revenueDelta).toFixed(1)}% ·{" "}
              {formatPeso(summary.totalSales)} vs {formatPeso(priorSummary.totalSales)}
            </span>
          )
        }
      >
        <LineChart
          labels={currentDaily.slice(0, comparableDays).map((d) => d.label)}
          series={[
            {
              label: "This period",
              values: currentDaily.slice(0, comparableDays).map((d) => d.total),
              color: "var(--color-primary)",
              area: true,
              format: formatPeso,
            },
            {
              label: "Previous period",
              values: priorDaily.slice(0, comparableDays).map((d) => d.total),
              color: "var(--color-text-muted)",
              dashed: true,
              format: formatPeso,
            },
          ]}
          height={260}
        />
      </ChartCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Q2 — What time of day does this store actually make money? */}
        <ChartCard
          title="Sales by hour of day"
          question="What time of day does this store actually make money — when should the register be staffed?"
        >
          <BarChart
            data={tradingHours.map((h) => ({
              label: h.label,
              value: h.total,
              tooltip: `${formatPeso(h.total)} across ${h.count} sale${h.count === 1 ? "" : "s"}`,
            }))}
            height={220}
          />
        </ChartCard>

        {/* Q3 — Which categories carry the business? */}
        <ChartCard
          title="Revenue by category"
          question="Which categories carry the business, and which are just shelf space?"
        >
          <DonutChart
            data={categorySales.rows.map((r) => ({ label: r.categoryName, value: r.revenue }))}
            format={formatPeso}
            centerLabel={formatPeso(summary.totalSales)}
            centerSubLabel="total"
          />
        </ChartCard>

        {/* Q4 — How are customers actually paying? */}
        <ChartCard
          title="Payment methods"
          question="How are customers actually paying — how much cash should the drawer hold?"
        >
          <DonutChart
            data={summary.byPaymentMethod.map((p) => ({ label: p.method, value: p.total }))}
            format={formatPeso}
            centerLabel={String(summary.transactionCount)}
            centerSubLabel="transactions"
          />
        </ChartCard>

        {/* Q5 — What has to be reordered right now? */}
        <ChartCard
          title="At or below reorder point"
          question="What has to be reordered right now, and which items are furthest below the line?"
          action={
            <LinkButton href="/inventory?status=low" variant="secondary" size="sm">
              See all
            </LinkButton>
          }
        >
          <HorizontalBarChart
            emptyMessage="Nothing is at or below its reorder point."
            data={reorderAlerts.map((r) => ({
              key: `${r.productId}-${r.sku}`,
              label: (
                <ProductLink productId={r.productId}>
                  {r.productName}
                  {r.variantName ? ` — ${r.variantName}` : ""}
                </ProductLink>
              ),
              value: r.shortfall,
              valueLabel: `${r.quantityOnHand} left`,
              subLabel: `${r.sku} · reorder at ${r.reorderThreshold} · ${r.shortfall} below`,
              color: r.quantityOnHand < 0 ? "var(--color-danger)" : "var(--color-warning)",
            }))}
          />
        </ChartCard>

        {/* Q6 — Where is cash sitting still? */}
        <ChartCard
          title="Slow-moving stock"
          question="Where is my money stuck — which stocked products sold nothing this period?"
          note={
            slowMovers.length > 0 ? (
              <span className="text-text-muted">
                {formatPeso(slowMovers.reduce((s, r) => s + r.stockValue, 0))} of stock (at cost) sat
                unsold
              </span>
            ) : undefined
          }
        >
          <HorizontalBarChart
            emptyMessage="Every stocked product sold at least one unit this period."
            data={slowMovers.map((r) => ({
              key: String(r.productId),
              label: <ProductLink productId={r.productId}>{r.productName}</ProductLink>,
              value: r.stockValue,
              valueLabel: formatPeso(r.stockValue),
              subLabel: `${r.sku} · ${r.quantityOnHand} on hand · 0 sold`,
              color: "var(--color-accent)",
            }))}
          />
        </ChartCard>

        <Card className="flex flex-col gap-4 p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-heading text-sm font-semibold text-text">Top products</h2>
            <LinkButton href="/reports/product-performance" variant="secondary" size="sm">
              See all
            </LinkButton>
          </div>
          <div className="flex flex-col gap-1 px-4 pb-4">
            {topProducts.length === 0 ? (
              <EmptyState message="No completed sales in this period yet." />
            ) : (
              topProducts.map((p) => (
                <div
                  key={p.productId}
                  className="flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors duration-150 hover:bg-bg"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <BoxIcon className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      <ProductLink productId={p.productId}>{p.name}</ProductLink>
                    </p>
                    <p className="truncate text-xs text-text-muted">{p.sku} · {p.quantitySold} sold</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-text">
                    {formatPeso(p.revenue)}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

/**
 * Chart panel. `question` is rendered as the sub-heading on purpose: every chart on this
 * dashboard exists to answer one store-owner question, and stating it beats making the
 * reader infer it from the axes.
 */
function ChartCard({
  title,
  question,
  note,
  action,
  children,
}: {
  title: string;
  question: string;
  note?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-4 p-0">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="font-heading text-sm font-semibold text-text">{title}</h2>
          <p className="mt-0.5 text-xs text-text-muted">{question}</p>
          {note && <p className="mt-1 text-xs font-medium">{note}</p>}
        </div>
        {action}
      </div>
      <div className="px-4 pb-4">{children}</div>
    </Card>
  );
}
