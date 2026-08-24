import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import IdleLockGuard from "@/app/components/IdleLockGuard";
import ReturnsTerminal from "@/app/components/returns/ReturnsTerminal";

export default async function ReturnsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <IdleLockGuard>
      <ReturnsTerminal cashierName={user.name} canApproveRefund={user.role.canApproveRefund} />
    </IdleLockGuard>
  );
}
