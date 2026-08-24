import Link from "next/link";
import LogoutButton from "@/app/components/LogoutButton";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Products", href: "/products" },
  { label: "Categories", href: "/categories" },
  { label: "Inventory", href: "/inventory" },
  { label: "Customers", href: "/customers" },
  { label: "Suppliers", href: "/suppliers" },
  { label: "Purchase Orders", href: "/purchase-orders" },
  { label: "Staff", href: "/staff" },
  { label: "Reports", href: "/reports" },
  { label: "Settings", href: "/settings" },
] as const;

export default function BackOfficeNav({
  userName,
  roleName,
}: {
  userName: string;
  roleName: string;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-surface px-6 py-3">
      <nav className="flex flex-wrap items-center gap-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-md px-3 text-sm font-medium text-text-muted transition-colors duration-150 hover:bg-bg hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-3">
        <span className="text-sm text-text-muted">
          {userName} · <span className="font-medium text-text">{roleName}</span>
        </span>
        <LogoutButton />
      </div>
    </header>
  );
}
