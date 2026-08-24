import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getInventoryValuationReport, DEFAULT_LOCATION_ID } from "@/lib/reports";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET() {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    return NextResponse.json({ error: gate.message }, { status: gate.status });
  }

  const report = await getInventoryValuationReport(DEFAULT_LOCATION_ID);

  const csv = toCsv(
    ["SKU", "Product", "Category", "On hand", "Cost price", "Value"],
    report.rows.map((r) => [r.sku, r.productName, r.categoryName, r.quantityOnHand, r.costPrice, r.value]),
  );

  return csvResponse(csv, `inventory-valuation_${new Date().toISOString().slice(0, 10)}.csv`);
}
