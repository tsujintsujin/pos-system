import { redirect } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import PageHeader from "@/app/components/ui/PageHeader";
import Card from "@/app/components/ui/Card";
import { WarningTriangleIcon, FolderIcon, WalletIcon, CashIcon, TagIcon, BuildingIcon } from "@/app/components/ui/icons";

const SETTINGS_SECTIONS = [
  {
    href: "/settings/store-profile",
    label: "Store profile",
    desc: "Name, address, currency symbol, cash rounding, receipt branding (Location #1)",
    icon: FolderIcon,
  },
  {
    href: "/settings/tax-classes",
    label: "Tax configuration",
    desc: "Tax classes and rates",
    icon: CashIcon,
  },
  {
    href: "/settings/payment-methods",
    label: "Payment methods",
    desc: "Enable/disable accepted payment methods",
    icon: WalletIcon,
  },
  {
    href: "/settings/discounts",
    label: "Discounts",
    desc: "Named discounts for the Sales Terminal quick-pick",
    icon: TagIcon,
  },
  {
    href: "/settings/locations",
    label: "Locations",
    desc: "Manage stores and registers for future multi-store use",
    icon: BuildingIcon,
  },
] as const;

export default async function SettingsIndexPage() {
  const gate = await requireRole("canManageSettings");
  if (!gate.ok) {
    redirect(`/dashboard?error=${encodeURIComponent(gate.message)}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" subtitle="Store, tax, and payment configuration" />

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SETTINGS_SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <li key={s.href}>
              <Link href={s.href} className="block cursor-pointer">
                <Card className="flex h-full items-start gap-3 transition-colors duration-150 hover:border-primary hover:bg-bg">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="font-medium text-text">{s.label}</span>
                    <span className="text-xs text-text-muted">{s.desc}</span>
                  </span>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>

      <Card className="border-warning-border bg-warning-bg">
        <h2 className="mb-2 flex items-center gap-2 font-heading text-sm font-semibold text-warning">
          <WarningTriangleIcon className="h-4 w-4" />
          Not yet configurable
        </h2>
        <p className="mb-2 text-sm text-warning">
          Currency symbol, cash rounding, and receipt logo/footer now persist on{" "}
          <code>Location</code> (see Store profile) and are applied in the Sales Terminal
          (cart, payment, and receipt) — that&apos;s a deliberately scoped-down v1. These items
          remain unfinished:
        </p>
        <ul className="list-inside list-disc text-sm text-warning">
          <li>
            Currency symbol &amp; receipt branding elsewhere in the app — ₱ is still hardcoded
            as a literal string in ~30+ other files (Reports, Inventory, Purchase Orders,
            Returns, etc.), and the Returns/Return-receipt flow specifically still shows the
            hardcoded ₱ and no logo/footer
          </li>
          <li>Multi-language support</li>
          <li>Register/terminal-level settings beyond the existing Register.name</li>
        </ul>
      </Card>
    </div>
  );
}
