import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setSessionCookie } from "@/lib/auth";

/**
 * One-click entry to the public read-only demo.
 *
 * No credentials are accepted or checked: the demo account is intentionally
 * public, so there is nothing to guess and nothing to brute-force — which is
 * also why this route is deliberately left out of the rate limiter that guards
 * /api/auth/login and /api/auth/pin.
 *
 * Safety does not come from this route. It comes from the DEMO role holding no
 * permission flags, and from proxy.ts rejecting every non-GET request made with
 * a DEMO session.
 */
export const DEMO_EMAIL = "demo@possystem.local";

export async function POST() {
  const user = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
    include: { role: true },
  });

  if (!user || !user.active) {
    return NextResponse.json(
      { error: "demo_unavailable", message: "The demo account is not configured on this deployment." },
      { status: 503 },
    );
  }

  // Refuse to hand out a session if the demo account has somehow been granted a
  // writable role — better to break the demo button than to expose a live admin.
  if (user.role.name !== "DEMO") {
    return NextResponse.json(
      { error: "demo_misconfigured", message: "The demo account is not assigned the DEMO role." },
      { status: 503 },
    );
  }

  await setSessionCookie({
    userId: user.id,
    roleId: user.roleId,
    roleName: user.role.name,
    locationId: user.locationId ?? null,
  });

  return NextResponse.json({ ok: true, user: { id: user.id, name: user.name, roleName: user.role.name } });
}
