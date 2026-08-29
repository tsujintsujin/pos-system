import { getSession } from "@/lib/auth";

/**
 * Shown on every authenticated page when the current session is the public demo.
 *
 * This is signage, not a security control — writes are already rejected by
 * proxy.ts. Its job is to set expectations before someone tries to save
 * something and gets a 403 they weren't expecting.
 */
export default async function DemoBanner() {
  const session = await getSession();
  if (session?.roleName !== "DEMO") return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-amber-100 px-4 py-2 text-center text-sm text-amber-900"
    >
      <span className="font-semibold">Read-only demo.</span>
      <span>Browse everything — sample data only, and no changes are saved.</span>
    </div>
  );
}
