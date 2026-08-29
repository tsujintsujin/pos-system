import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { containsInsensitive } from "@/lib/list-params";
import { getCurrentUser } from "@/lib/auth";

export interface CustomerSearchResult {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  storeCreditBalance: number;
}

/**
 * GET /api/customers/search?q=... — used by the Sales Terminal's customer picker
 * (app/components/sales/CustomerPicker.tsx) to look a customer up by name/phone/email
 * before attaching them to the cart. Mirrors /api/sales/search's auth + query shape.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({ results: [] });
  }

  const customers = await prisma.customer.findMany({
    where: {
      OR: [
        { name: containsInsensitive(q) },
        { phone: containsInsensitive(q) },
        { email: containsInsensitive(q) },
      ],
    },
    select: { id: true, name: true, phone: true, email: true, storeCreditBalance: true },
    orderBy: { name: "asc" },
    take: 10,
  });

  const results: CustomerSearchResult[] = customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    storeCreditBalance: c.storeCreditBalance.toNumber(),
  }));

  return NextResponse.json({ results });
}
