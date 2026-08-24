import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateStoreProfile } from "@/app/actions/settings";
import Banner from "@/app/components/Banner";
import PageHeader from "@/app/components/ui/PageHeader";
import Card from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Textarea from "@/app/components/ui/Textarea";
import Button from "@/app/components/ui/Button";

const DEFAULT_LOCATION_ID = 1;

export default async function StoreProfileSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const gate = await requireRole("canManageSettings");
  if (!gate.ok) {
    redirect(`/dashboard?error=${encodeURIComponent(gate.message)}`);
  }

  const sp = await searchParams;
  const location = await prisma.location.findUnique({ where: { id: DEFAULT_LOCATION_ID } });
  if (!location) {
    redirect(`/settings?error=${encodeURIComponent("Default location not found")}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Store profile" backHref="/settings" backLabel="Settings" />

      <Banner error={sp.error} success={sp.success} />

      <p className="text-xs text-text-muted">
        Currency symbol and receipt branding below apply only to the Sales Terminal
        (cart/payment/receipt) for now — the rest of the app still shows ₱ as a fixed
        literal (see the Settings hub for the full gap list). There&apos;s also no
        multi-language or per-register override support.
      </p>

      <Card className="max-w-lg">
        <form action={updateStoreProfile} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="text-xs font-medium text-text-muted">
              Store name <span className="text-danger">*</span>
            </label>
            <Input id="name" name="name" required defaultValue={location.name} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="address" className="text-xs font-medium text-text-muted">
              Address
            </label>
            <Textarea id="address" name="address" rows={3} defaultValue={location.address ?? ""} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="currencySymbol" className="text-xs font-medium text-text-muted">
                Currency symbol
              </label>
              <Input
                id="currencySymbol"
                name="currencySymbol"
                maxLength={3}
                className="w-24"
                defaultValue={location.currencySymbol}
              />
              <p className="text-xs text-text-muted">Used in the Sales Terminal cart, payment, and receipt.</p>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="cashRoundingIncrement" className="text-xs font-medium text-text-muted">
                Cash rounding increment
              </label>
              <Input
                id="cashRoundingIncrement"
                name="cashRoundingIncrement"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 1.00"
                defaultValue={location.cashRoundingIncrement?.toString() ?? ""}
              />
              <p className="text-xs text-text-muted">
                0 or blank = no rounding. Applies only to cash tenders in the Sales Terminal —
                the recorded sale total is never rounded.
              </p>
            </div>
          </div>

          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label htmlFor="receiptLogoUrl" className="text-xs font-medium text-text-muted">
                Receipt logo URL
              </label>
              <Input
                id="receiptLogoUrl"
                name="receiptLogoUrl"
                type="url"
                placeholder="https://example.com/logo.png"
                defaultValue={location.receiptLogoUrl ?? ""}
                className="mt-1"
              />
              <p className="mt-1 text-xs text-text-muted">
                Link to an already-hosted image — this app has no file upload/storage set up.
              </p>
            </div>
            {location.receiptLogoUrl && (
              // Same plain-<img>-no-upload pattern as Product.imageUrl on the product edit
              // page — arbitrary external URL, no remotePatterns needed, broken URL just
              // falls back to the browser's default broken-image icon.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={location.receiptLogoUrl}
                alt={location.name}
                className="h-16 w-16 shrink-0 rounded-md border border-border object-contain"
              />
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="receiptFooterText" className="text-xs font-medium text-text-muted">
              Receipt footer text
            </label>
            <Textarea
              id="receiptFooterText"
              name="receiptFooterText"
              rows={2}
              placeholder="e.g. Thank you for shopping with us!"
              defaultValue={location.receiptFooterText ?? ""}
            />
          </div>

          <div className="pt-2">
            <Button type="submit">Save changes</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
