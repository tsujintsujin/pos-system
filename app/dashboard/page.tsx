import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  parseDateRange,
  getSalesSummaryReport,
  getProductPerformanceReport,
  DEFAULT_LOCATION_ID,
  round2,
  type DateRange,
} from "@/lib/reports";
import PageHeader from "@/app/components/ui/PageHeader";
import Card from "@/app/components/ui/Card";
import { LinkButton } from "@/app/components/ui/Button";
import EmptyState from "@/app/components/ui/EmptyState";
import DashboardStatCard from "@/app/components/ui/DashboardStatCard";
import BarChart from "@/app/components/ui/BarChart";
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

function toDateInputStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Quick-select presets for the stat-card numbers (Today / This week / This month). Kept
 * separate from the always-last-7-days trend data used by the sparklines and bar chart below. */
function resolveQuickRange(key: DashboardRangeKey): DateRange {
  const now = new Date();

  if (key === "today") {
    const fromStr = toDateInputStr(now);
    return {
      from: new Date(`${fromStr}T00:00:00`),
      to: new Date(`${fromStr}T23:59:59.999`),
      fromStr,
      toStr: fromStr,
    };
  }

  if (key === "month") {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const fromStr = toDateInputStr(monthStart);
    const toStr = toDateInputStr(now);
    return {
      from: new Date(`${fromStr}T00:00:00`),
      to: new Date(`${toStr}T23:59:59.999`),
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
  const last7 = parseDateRange({}); // fixed last-7-days window for sparklines/bar chart

  const [summary, last7Summary, productPerformance, productCount, customerCount, inventoryRows, products] =
    await Promise.all([
      getSalesSummaryReport(range),
      getSalesSummaryReport(last7),
      getProductPerformanceReport(range),
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
  // and bar chart always show a consistent 7-point shape, with 0s for days with no
  // completed sales, rather than silently compressing/skipping gaps.
  const byDayMap = new Map(last7Summary.byDay.map((d) => [d.date, d]));
  const last7Days: { date: string; label: string; total: number; count: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(last7.from);
    date.setDate(date.getDate() + i);
    const dateStr = toDateInputStr(date);
    const entry = byDayMap.get(dateStr);
    last7Days.push({
      date: dateStr,
      label: DAY_LABELS[date.getDay()],
      total: round2(entry?.total ?? 0),
      count: entry?.count ?? 0,
    });
  }

  const salesTrend = last7Days.map((d) => d.total);
  const transactionsTrend = last7Days.map((d) => d.count);
  const barData = last7Days.map((d) => ({
    label: d.label,
    value: d.total,
    tooltip: `₱${d.total.toFixed(2)}`,
  }));

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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
                    <p className="truncate text-sm font-medium text-text">{p.name}</p>
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

        <Card className="flex flex-col gap-4 p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-heading text-sm font-semibold text-text">Sales this week</h2>
            <span className="text-xs font-medium text-text-muted">Last 7 days</span>
          </div>
          <div className="px-4 pb-4">
            <BarChart data={barData} height={220} />
          </div>
        </Card>
      </div>
    </div>
  );
}
