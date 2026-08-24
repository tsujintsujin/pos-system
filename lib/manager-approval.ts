import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/**
 * Shared manager-PIN-approval check used by both `/api/returns/verify-manager-pin`
 * (instant client-side feedback while the cashier is filling in the return form) and
 * `completeReturn` (the source-of-truth server-side check — never trust a client-sent
 * "approved" flag alone). Deliberately reuses the same bcrypt-compare-against-active-users
 * pattern as `/api/auth/pin` (see that route's docstring), but scoped to users whose Role
 * has `canApproveRefund = true`, and — unlike the quick-switch flow — never swaps the
 * session cookie. This is a one-time approval stamp, not a user switch.
 */
export async function findApprovingManager(pin: string) {
  const trimmed = pin.trim();
  if (!trimmed) return null;

  const candidates = await prisma.user.findMany({
    where: { active: true, pinHash: { not: null }, role: { canApproveRefund: true } },
    include: { role: true },
  });

  for (const user of candidates) {
    if (!user.pinHash) continue;
    const matches = await bcrypt.compare(trimmed, user.pinHash);
    if (matches) return user;
  }

  return null;
}
