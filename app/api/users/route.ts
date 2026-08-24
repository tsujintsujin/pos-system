import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

/**
 * Example back-office endpoint establishing the requireRole() pattern for later phases
 * (Staff/User management, phase 3+). Gated by Role.canManageUsers — ADMIN only by
 * default seed data (see prisma/seed.ts).
 */
export async function GET() {
  const gate = await requireRole("canManageUsers");
  if (!gate.ok) {
    return NextResponse.json({ error: gate.message }, { status: gate.status });
  }

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, active: true, role: { select: { name: true } } },
    orderBy: { id: "asc" },
  });

  return NextResponse.json({ users });
}
