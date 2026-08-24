/**
 * Refund amount above which a manager (Role.canApproveRefund = true) must approve the
 * return via PIN before it completes. Lives in its own plain module (not inside
 * app/actions/returns.ts) because a "use server" file may only export async functions —
 * a client component needs this constant too (for the "manager approval required" UI
 * hint), so it can't be exported directly from the server-action file.
 */
export const MANAGER_APPROVAL_THRESHOLD = 500;
