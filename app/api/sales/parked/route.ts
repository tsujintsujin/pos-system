import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const DEFAULT_LOCATION_ID = 1;

export interface ParkedSaleSummary {
  id: number;
  createdAt: string;
  cashierName: string;
  itemCount: number;
  grandTotal: number;
}

/** GET /api/sales/parked — list of held sales at this location, newest first, for the "Resume" panel. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parked = await prisma.sale.findMany({
    where: { locationId: DEFAULT_LOCATION_ID, status: "PARKED" },
    include: {
      cashier: { select: { name: true } },
      lineItems: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const results: ParkedSaleSummary[] = parked.map((s) => ({
    id: s.id,
    createdAt: s.createdAt.toISOString(),
    cashierName: s.cashier.name,
    itemCount: s.lineItems.length,
    grandTotal: s.grandTotal.toNumber(),
  }));

  return NextResponse.json({ results });
}
