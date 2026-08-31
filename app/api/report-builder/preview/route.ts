import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { parseDateRange } from "@/lib/reports";
import { coerceConfig } from "@/lib/report-builder/config";
import { runReport } from "@/lib/report-builder/query";
import type { ReportResult } from "@/lib/report-builder/types";

/**
 * Runs report-builder visuals against live POS data.
 *
 * GET, not POST, even though the payload is a JSON document: this only ever reads. The
 * demo role is blocked from every non-GET request in proxy.ts precisely so no handler can
 * quietly become writable, and a read endpoint that announced itself as a write would both
 * trip that guard and misdescribe itself.
 *
 * Takes an array so the dashboard can render all of its published visuals in one round
 * trip rather than N. Results come back index-aligned with the configs sent.
 */

/** Ceiling on visuals per request — each one is its own aggregate scan. */
const MAX_CONFIGS = 12;

const EMPTY: ReportResult = { columns: [], rows: [], truncated: false };

export async function GET(request: NextRequest) {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    return NextResponse.json({ error: gate.message }, { status: gate.status });
  }

  const sp = request.nextUrl.searchParams;

  let rawConfigs: unknown;
  try {
    rawConfigs = JSON.parse(sp.get("configs") ?? "[]");
  } catch {
    return NextResponse.json({ error: "Malformed `configs` parameter." }, { status: 400 });
  }

  if (!Array.isArray(rawConfigs)) {
    return NextResponse.json({ error: "Expected a `configs` array." }, { status: 400 });
  }
  if (rawConfigs.length > MAX_CONFIGS) {
    return NextResponse.json({ error: `At most ${MAX_CONFIGS} visuals per request.` }, { status: 400 });
  }

  const range = parseDateRange({
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
  });

  // One bad config shouldn't blank the whole dashboard, so failures resolve to an empty
  // result for that slot and the rest still render.
  const results = await Promise.all(
    rawConfigs.map(async (raw): Promise<ReportResult> => {
      const config = coerceConfig(raw);
      if (!config) return EMPTY;
      try {
        return await runReport(config, range);
      } catch (error) {
        console.error("[report-builder] query failed", error);
        return EMPTY;
      }
    }),
  );

  return NextResponse.json(
    { results, from: range.fromStr, to: range.toStr },
    // Live figures: a cached dashboard visual would quietly go stale after a sale.
    { headers: { "Cache-Control": "no-store" } },
  );
}
