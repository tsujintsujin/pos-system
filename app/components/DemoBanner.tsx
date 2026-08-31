import { getSession } from "@/lib/auth";

/**
 * Shown on every authenticated page when the current session is the public demo.
 *
 * This is signage, not a security control — writes are already rejected by
 * proxy.ts. Its job is to set expectations before someone tries to save
 * something and gets a 403 they weren't expecting.
 *
 * Rendered as a viewport-pinned pill rather than a full-bleed strip: `fixed`
 * keeps it out of normal flow, so a demo page's content starts at exactly the
 * same y-offset as a signed-in one and nothing below needs demo-aware spacing.
 * `pointer-events-none` matters because it now floats over real controls (the
 * mobile menu button sits directly under it) — the pill must never eat a click.
 *
 * The `peer` class is load-bearing: GlobalProcessingIndicator is a following
 * sibling in <body> and uses `peer-[[role=status]]:*` to drop below this pill on
 * narrow viewports, where a centered pill and a right-pinned toast cannot both
 * fit on one row. When the session isn't DEMO this element doesn't render, the
 * sibling selector never matches, and the indicator keeps its usual position.
 */
export default async function DemoBanner() {
  const session = await getSession();
  if (session?.roleName !== "DEMO") return null;

  return (
    <div
      role="status"
      className="peer pointer-events-none fixed inset-x-0 top-2 z-50 flex justify-center px-4"
    >
      <p className="flex max-w-full flex-wrap items-center justify-center gap-x-1.5 rounded-full border border-amber-300 bg-amber-100 px-4 py-1.5 text-center text-xs text-amber-900 shadow-sm">
        <span className="font-semibold">Read-only demo.</span>
        <span>Nothing you change is saved.</span>
      </p>
    </div>
  );
}
