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
 * Same 10 back-office routes that used to live in BackOfficeNav's top bar — grouped here
 * into sensible sections. None dropped, only regrouped + relocated into a persistent
 * left sidebar. Keep in sync with app/(catalog)/**\/page.tsx if routes are ever added/removed.
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
      { label: "Suppliers", href: "/suppliers", icon: TruckIcon },
      { label: "Purchase Orders", href: "/purchase-orders", icon: ClipboardIcon },
      { label: "Staff", href: "/staff", icon: UsersIcon },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Reports", href: "/reports", icon: ChartBarIcon },
      { label: "Settings", href: "/settings", icon: SettingsIcon },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar({
  userName,
  roleName,
}: {
  userName: string;
  roleName: string;
}) {
  const pathname = usePathname();
  const initial = userName.trim().charAt(0).toUpperCase() || "?";

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="border-b border-border px-5 py-5">
        <span className="font-heading text-lg font-semibold tracking-tight text-text">
          POS System
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-5 last:mb-0">
            <h2 className="mb-1.5 px-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
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
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors duration-150",
                        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-text-muted hover:bg-bg hover:text-text",
                      )}
                    >
                      <Icon className="h-4.5 w-4.5 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <div className="mb-2 flex items-center gap-2.5 rounded-md px-2 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text">{userName}</p>
            <p className="truncate text-xs text-text-muted">{roleName}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-1">
          <Link
            href="/switch-user"
            className="inline-flex min-h-11 flex-1 cursor-pointer items-center gap-1.5 rounded-md px-2 text-sm font-medium text-text-muted transition-colors duration-150 hover:bg-bg hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <LogoutArrowIcon className="h-4 w-4" />
            Switch user
          </Link>
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}
