"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getActiveShift, getShiftSummary, DEFAULT_LOCATION_ID, DEFAULT_REGISTER_ID } from "@/lib/shift";
import type { CashMovementType } from "@/app/generated/prisma/enums";

const VALID_MOVEMENT_TYPES: CashMovementType[] = ["PAID_IN", "PAID_OUT", "SAFE_DROP"];

/**
 * Open a shift for the current cashier on the default register, and clock them in.
 * Only one open shift per user at a time — the Sales Terminal (app/sales/page.tsx)
 * redirects here whenever the cashier has none, so by the time completeSale runs a
 * shift is guaranteed open, but the action re-checks anyway (defense in depth).
 */
export async function openShift(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const existing = await getActiveShift(user.id);
  if (existing) {
    redirect(`/shift?error=${encodeURIComponent("You already have an open shift")}`);
  }

  const floatRaw = String(formData.get("openingFloat") ?? "").trim();
  const openingFloat = Number(floatRaw);
  if (!floatRaw || Number.isNaN(openingFloat) || openingFloat < 0) {
    redirect(`/shift?error=${encodeURIComponent("Enter a valid opening float (0 or more)")}`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.shift.create({
      data: {
        registerId: DEFAULT_REGISTER_ID,
        locationId: DEFAULT_LOCATION_ID,
        cashierId: user.id,
        openingFloat,
      },
    });

    // Auto clock-in alongside shift open, for convenience — see TimeClockEntry usage in
    // closeShift for the matching clock-out. Only start a new entry if none is already open.
    const openEntry = await tx.timeClockEntry.findFirst({
      where: { userId: user.id, clockOut: null },
    });
    if (!openEntry) {
      await tx.timeClockEntry.create({ data: { userId: user.id } });
    }
  });

  revalidatePath("/shift");
  revalidatePath("/sales");
  redirect("/shift?success=" + encodeURIComponent("Shift opened"));
}

/**
 * Record a cash movement (paid-in / paid-out / safe-drop) against the active shift.
 */
export async function recordCashMovement(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const shift = await getActiveShift(user.id);
  if (!shift) {
    redirect(`/shift?error=${encodeURIComponent("No open shift to record a cash movement against")}`);
  }

  const type = String(formData.get("type") ?? "") as CashMovementType;
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const amount = Number(amountRaw);
  const reason = String(formData.get("reason") ?? "").trim() || null;

  if (!VALID_MOVEMENT_TYPES.includes(type)) {
    redirect(`/shift?error=${encodeURIComponent("Select a valid movement type")}`);
  }
  if (!amountRaw || Number.isNaN(amount) || amount <= 0) {
    redirect(`/shift?error=${encodeURIComponent("Amount must be greater than zero")}`);
  }

  await prisma.cashMovement.create({
    data: { shiftId: shift.id, type, amount, reason, createdById: user.id },
  });

  revalidatePath("/shift");
  redirect("/shift?success=" + encodeURIComponent("Cash movement recorded"));
}

/**
 * Close the active shift: compute expectedCash/variance from the same ledger math used
 * by the X-report (lib/shift.ts getShiftSummary), persist them alongside the counted
 * cash, clock the cashier out, and stamp closedAt — all inside one transaction so a
 * sale completing mid-close can't be silently missed or double-counted.
 */
export async function closeShift(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const shift = await getActiveShift(user.id);
  if (!shift) {
    redirect(`/shift?error=${encodeURIComponent("No open shift to close")}`);
  }

  const countRaw = String(formData.get("closingCount") ?? "").trim();
  const closingCount = Number(countRaw);
  if (!countRaw || Number.isNaN(closingCount) || closingCount < 0) {
    redirect(`/shift?error=${encodeURIComponent("Enter the counted cash amount (0 or more)")}`);
  }

  const closedShiftId = await prisma.$transaction(async (tx) => {
    const summary = await getShiftSummary(tx, shift.id);
    if (!summary) throw new Error("Shift not found");

    const variance = round2(closingCount - summary.expectedCash);

    await tx.shift.update({
      where: { id: shift.id },
      data: {
        closingCount,
        expectedCash: summary.expectedCash,
        variance,
        closedAt: new Date(),
      },
    });

    const openEntry = await tx.timeClockEntry.findFirst({
      where: { userId: user.id, clockOut: null },
      orderBy: { clockIn: "desc" },
    });
    if (openEntry) {
      await tx.timeClockEntry.update({ where: { id: openEntry.id }, data: { clockOut: new Date() } });
    }

    return shift.id;
  });

  revalidatePath("/shift");
  revalidatePath("/sales");
  redirect(`/shifts/${closedShiftId}`);
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
