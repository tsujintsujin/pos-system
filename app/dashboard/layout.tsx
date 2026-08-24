import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import IdleLockGuard from "@/app/components/IdleLockGuard";
import AppShell from "@/app/components/AppShell";

/**
 * /dashboard sits outside the (catalog) route group (it existed before that group was
 * introduced) but shares the same persistent-sidebar shell as every other back-office
 * page — see app/(catalog)/layout.tsx for the sibling implementation.
 */
export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
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
