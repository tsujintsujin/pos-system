import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { findApprovingManager } from "@/lib/manager-approval";

/**
 * POST /api/returns/verify-manager-pin — one-shot check of a PIN against every active
 * user whose Role has `canApproveRefund = true`. Used by the Returns terminal's manager-
 * approval modal to give the cashier instant "approved by <name>" / "invalid PIN"
 * feedback while filling out a large refund, without swapping the session cookie the way
 * the quick-switch flow (`/api/auth/pin`) does.
 *
 * This is UX-only — `completeReturn` (app/actions/returns.ts) independently re-verifies
 * the PIN server-side before actually processing the refund, so a tampered client can't
 * skip the gate by faking a success response here.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { pin?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const pin = body.pin?.trim();
  if (!pin) {
    return NextResponse.json({ error: "PIN is required" }, { status: 400 });
  }

  const manager = await findApprovingManager(pin);
  if (!manager) {
    return NextResponse.json({ error: "Invalid PIN, or that PIN does not belong to a manager who can approve refunds" }, { status: 401 });
  }

  return NextResponse.json({ ok: true, manager: { id: manager.id, name: manager.name } });
}
