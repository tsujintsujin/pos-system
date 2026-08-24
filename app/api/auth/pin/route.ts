import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { setSessionCookie } from "@/lib/auth";

/**
 * Shared-terminal quick-switch: given a PIN, find the matching active user and swap
 * the session cookie to that user — no full logout/login round trip.
 *
 * Also doubles as the idle-lock "resume" flow: the lock screen posts here with the
 * PIN of whichever user wants to resume (same user or a different cashier taking over).
 *
 * Note: PINs aren't looked up by a plaintext index (only pinHash is stored), so we
 * bcrypt.compare against each active user that has a PIN set. Fine at small cashier-list
 * scale; revisit if the staff list grows large.
 */
export async function POST(request: Request) {
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

  const candidates = await prisma.user.findMany({
    where: { active: true, pinHash: { not: null } },
    include: { role: true },
  });

  for (const user of candidates) {
    if (!user.pinHash) continue;
    const matches = await bcrypt.compare(pin, user.pinHash);
    if (matches) {
      await setSessionCookie({
        userId: user.id,
        roleId: user.roleId,
        roleName: user.role.name,
        locationId: user.locationId ?? null,
      });
      return NextResponse.json({
        ok: true,
        user: { id: user.id, name: user.name, roleName: user.role.name },
      });
    }
  }

  return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
}
