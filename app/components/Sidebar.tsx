"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import LogoutButton from "@/app/components/LogoutButton";
import {
  HomeIcon,
  BoxIcon,
  FolderIcon,
  StackIcon,
  UserIcon,
  TruckIcon,
  ClipboardIcon,
  UsersIcon,
  ChartBarIcon,
  SettingsIcon,
  LogoutArrowIcon,
  PrinterIcon,
  ChevronLeftIcon,
  MenuIcon,
  PencilIcon,
} from "@/app/components/ui/icons";

interface NavItem {
  label: string;
  href: string;
  icon: (props: { className?: string }) => React.ReactElement;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

/**
 * Back-office routes, grouped into sections. Keep in sync with the pages under
 * app/(catalog)/ if routes are ever added or removed.
 */
const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/dashboard", icon: HomeIcon }],
  },
  {
    label: "Catalog",
    items: [
      { label: "Products", href: "/products", icon: BoxIcon },
      { label: "Categories", href: "/categories", icon: FolderIcon },
      { label: "Inventory", href: "/inventory", icon: StackIcon },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Customers", href: "/customers", icon: UserIcon },
      { label: "Receipts", href: "/receipts", icon: PrinterIcon },
      { label: "Suppliers", href: "/suppliers", icon: TruckIcon },
      { label: "Purchase Orders", href: "/purchase-orders", icon: ClipboardIcon },
      { label: "Staff", href: "/staff", icon: UsersIcon },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Reports", href: "/reports", icon: ChartBarIcon },
      // Sits next to Reports on purpose: that one lists the fixed reports, this one builds
      // and publishes ad-hoc visuals. Different names so the nav never reads as a coin flip.
      { label: "Reports Visualizer", href: "/report-builder", icon: PencilIcon },
      { label: "Settings", href: "/settings", icon: SettingsIcon },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Collapsed = icon-only rail, and only at lg+ (the sub-lg off-canvas drawer is always
 * full width). Every collapsed-state class below is written as a max-lg:/lg: PAIR rather
 * than "base class + lg: override": cn() is a plain class-join, not a Tailwind class
 * merger, so a base px-2.5 and an lg:px-0 would both land in the DOM and whichever
 * Tailwind emits later wins — which is not reliably the lg: one.
 */
export default function Sidebar({
  userName,
  roleName,
  collapsed = false,
  onToggleCollapsed,
  onNavigate,
}: {
  userName: string;
  roleName: string;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  /** Called when a nav link is tapped — used to close the mobile drawer. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const initial = userName.trim().charAt(0).toUpperCase() || "?";

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border bg-surface transition-[width] duration-200",
        collapsed ? "max-lg:w-60 lg:w-16" : "w-60",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 border-b border-border py-5",
          collapsed
            ? "max-lg:justify-between max-lg:px-5 lg:justify-center lg:px-2"
            : "justify-between px-5",
        )}
      >
        <span
          className={cn(
            "font-heading text-lg font-semibold tracking-tight text-text",
            collapsed && "lg:hidden",
          )}
        >
          POS System
        </span>
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-muted transition-colors duration-150 hover:bg-bg hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:flex"
          >
            {collapsed ? <MenuIcon className="h-4 w-4" /> : <ChevronLeftIcon className="h-4 w-4" />}
          </button>
        )}
      </div>

      <nav
        className={cn(
          "flex-1 overflow-y-auto py-4",
          collapsed ? "max-lg:px-3 lg:px-2" : "px-3",
        )}
      >
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-5 last:mb-0">
            <h2
              className={cn(
                "mb-1.5 px-2 text-xs font-semibold uppercase tracking-wide text-text-muted",
                collapsed && "lg:hidden",
              )}
            >
              {section.label}
            </h2>
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={onNavigate}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md text-sm font-medium transition-colors duration-150",
                        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                        collapsed ? "max-lg:px-2.5 lg:justify-center lg:px-0" : "px-2.5",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-text-muted hover:bg-bg hover:text-text",
                      )}
                    >
                      <Icon className="h-4.5 w-4.5 shrink-0" />
                      <span className={cn(collapsed && "lg:hidden")}>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div
        className={cn(
          "border-t border-border py-3",
          collapsed ? "max-lg:px-3 lg:px-2" : "px-3",
        )}
      >
        <div
          className={cn(
            "mb-2 flex items-center gap-2.5 rounded-md py-2",
            collapsed ? "max-lg:px-2 lg:justify-center lg:px-0" : "px-2",
          )}
          title={collapsed ? `${userName} — ${roleName}` : undefined}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
            {initial}
          </span>
          <div className={cn("min-w-0 flex-1", collapsed && "lg:hidden")}>
            <p className="truncate text-sm font-medium text-text">{userName}</p>
            <p className="truncate text-xs text-text-muted">{roleName}</p>
          </div>
        </div>
        <div
          className={cn(
            "flex items-center",
            collapsed
              ? "max-lg:gap-1.5 max-lg:px-1 lg:flex-col lg:gap-2 lg:px-0"
              : "gap-1.5 px-1",
          )}
        >
          <Link
            href="/switch-user"
            title={collapsed ? "Switch user" : undefined}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-md text-sm font-medium text-text-muted transition-colors duration-150 hover:bg-bg hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              collapsed
                ? "max-lg:min-h-11 max-lg:flex-1 max-lg:px-2 lg:w-full lg:justify-center lg:px-0 lg:py-2.5"
                : "min-h-11 flex-1 px-2",
            )}
          >
            <LogoutArrowIcon className="h-4 w-4 shrink-0" />
            <span className={cn(collapsed && "lg:hidden")}>Switch user</span>
          </Link>
          <LogoutButton collapsed={collapsed} />
        </div>
      </div>
    </aside>
  );
}
