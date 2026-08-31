import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  parseDateRange,
  toStoreDateStr,
  type DateRange,
  getSalesSummaryReport,
  DEFAULT_LOCATION_ID,
  round2,
} from "@/lib/reports";
import PageHeader from "@/app/components/ui/PageHeader";
import { LinkButton } from "@/app/components/ui/Button";
import DashboardStatCard from "@/app/components/ui/DashboardStatCard";
import DashboardDateFilter, { type DatePreset } from "@/app/components/DashboardDateFilter";
import DashboardVisuals from "@/app/components/report-builder/DashboardVisuals";
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

/** Store-local YYYY-MM-DD, `days` after `dateStr`. */
function addStoreDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`); // midday: immune to DST edges
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Resolve the dashboard's window from the URL. `?range=` and `?from=&to=` are mutually
 * exclusive: a preset wins if present, a custom pair is used otherwise, and with neither
 * we fall back to the current month.
 *
 * Current month rather than parseDateRange's rolling 7 days: a week of a real store's data
 * is a handful of transactions, which reads as an empty system on first load even when
 * months sit behind it.
 */
function resolveDashboardRange(sp: { range?: string; from?: string; to?: string }): {
  activePreset: DatePreset | null;
  range: DateRange;
} {
  const today = toStoreDateStr(new Date());

  if (sp.from || sp.to) {
    return {
      activePreset: null,
      range: parseDateRange({ from: sp.from, to: sp.to }),
    };
  }

  const preset: DatePreset =
    sp.range === "today" || sp.range === "week" ? sp.range : "month";

  if (preset === "today") {
    return { activePreset: preset, range: parseDateRange({ from: today, to: today }) };
  }
  if (preset === "week") {
    // parseDateRange's own default is the rolling last 7 days.
    return { activePreset: preset, range: parseDateRange({}) };
  }
  return {
    activePreset: preset,
    range: parseDateRange({ from: `${today.slice(0, 7)}-01`, to: today }),
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const user = await getCurrentUser();

  // Belt-and-suspenders: proxy.ts already redirects unauthenticated requests to /login,
  // but the session cookie can still verify (valid JWT) while the underlying user was
  // deactivated/deleted in the DB — getCurrentUser() catches that case.
  if (!user) {
    redirect("/login");
  }

  const sp = await searchParams;
  const { activePreset, range } = resolveDashboardRange(sp);
  const last7 = parseDateRange({}); // fixed last-7-days window for the stat-card sparklines

  const [
    summary,
    last7Summary,
    productCount,
    customerCount,
    inventoryRows,
    products,
  ] = await Promise.all([
    getSalesSummaryReport(range),
    getSalesSummaryReport(last7),
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        subtitle={`Welcome back, ${user.name} — here's how the store is doing.`}
        actions={
          <DashboardDateFilter
            activePreset={activePreset}
            fromValue={range.fromStr}
            toValue={range.toStr}
          />
        }
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

      {/* Visuals the admin built in the Reports Visualizer and pinned here. Renders
          nothing until something is published, so a fresh dashboard stays clean. */}
      <DashboardVisuals fromStr={range.fromStr} toStr={range.toStr} />

    </div>
  );
}

