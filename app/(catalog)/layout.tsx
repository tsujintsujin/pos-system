import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import IdleLockGuard from "@/app/components/IdleLockGuard";
import AppShell from "@/app/components/AppShell";

/**
 * Route group (no URL segment) wrapping the back-office pages: /products, /categories,
 * /inventory, /customers, /suppliers, /purchase-orders, /staff, /reports, /settings.
 * Shares the same idle-lock guard as /dashboard plus a persistent left sidebar so these
 * pages aren't orphaned from the rest of the app. Sales Terminal / Returns / Shift are
 * intentionally NOT under this route group — they keep their own full-width, no-sidebar
 * checkout-focused layout.
 */
export default async function CatalogLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <IdleLockGuard>
      <AppShell userName={user.name} roleName={user.role.name}>
        {children}
      </AppShell>
    </IdleLockGuard>
  );
}
