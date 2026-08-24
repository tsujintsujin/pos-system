import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import IdleLockGuard from "@/app/components/IdleLockGuard";
import Sidebar from "@/app/components/Sidebar";

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
      <div className="flex min-h-screen w-full flex-1">
        <Sidebar userName={user.name} roleName={user.role.name} />
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8">
          {children}
        </div>
      </div>
    </IdleLockGuard>
  );
}
