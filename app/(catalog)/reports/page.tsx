import { redirect } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import PageHeader from "@/app/components/ui/PageHeader";
import Card from "@/app/components/ui/Card";
import {
  CashIcon,
  BoxIcon,
  WalletIcon,
  WarningTriangleIcon,
  FolderIcon,
  InboxIcon,
  UserIcon,
} from "@/app/components/ui/icons";

const REPORTS = [
  {
    href: "/reports/sales-summary",
    label: "Sales summary",
    desc: "Totals, daily breakdown, by payment method",
    icon: CashIcon,
  },
  {
    href: "/reports/product-performance",
    label: "Product performance",
    desc: "Best/worst sellers by qty and revenue",
    icon: BoxIcon,
  },
  {
    href: "/reports/sales-by-category",
    label: "Sales by category",
    desc: "Quantity and revenue, grouped by category",
    icon: FolderIcon,
  },
  {
    href: "/reports/tax",
    label: "Tax report",
    desc: "Tax collected, broken down by tax class",
    icon: WalletIcon,
  },
  {
    href: "/reports/void-refund",
    label: "Void / refund report",
    desc: "Voided sales and processed returns",
    icon: WarningTriangleIcon,
  },
  {
    href: "/reports/inventory-valuation",
    label: "Inventory valuation",
    desc: "Stock on hand x cost, current snapshot",
    icon: FolderIcon,
  },
  {
    href: "/reports/inventory-history",
    label: "Inventory history",
    desc: "Full stock movement ledger, filterable",
    icon: InboxIcon,
  },
  {
    href: "/reports/shifts",
    label: "Shift reconciliation",
    desc: "Past shifts and their cash variance",
    icon: UserIcon,
  },
] as const;

export default async function ReportsIndexPage() {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    redirect(`/dashboard?error=${encodeURIComponent(gate.message)}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Reports" subtitle="Sales, inventory, tax, and shift reporting" />

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          return (
            <li key={r.href}>
              <Link href={r.href} className="block cursor-pointer">
                <Card className="flex h-full items-start gap-3 transition-colors duration-150 hover:border-primary hover:bg-bg">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="font-medium text-text">{r.label}</span>
                    <span className="text-xs text-text-muted">{r.desc}</span>
                  </span>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
