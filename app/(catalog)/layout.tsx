import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import IdleLockGuard from "@/app/components/IdleLockGuard";
import Sidebar from "@/app/components/Sidebar";

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
      <div className="flex min-h-screen w-full flex-1">
        <Sidebar userName={user.name} roleName={user.role.name} />
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8">
          {children}
        </div>
      </div>
    </IdleLockGuard>
  );
}
