import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { togglePaymentMethodActive } from "@/app/actions/settings";
import Banner from "@/app/components/Banner";
import PageHeader from "@/app/components/ui/PageHeader";
import Card from "@/app/components/ui/Card";
import Badge from "@/app/components/ui/Badge";
import Button from "@/app/components/ui/Button";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/app/components/ui/Table";

export default async function PaymentMethodsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const gate = await requireRole("canManageSettings");
  if (!gate.ok) {
    redirect(`/dashboard?error=${encodeURIComponent(gate.message)}`);
  }

  const sp = await searchParams;
  const methods = await prisma.paymentMethod.findMany({
    include: { _count: { select: { payments: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Payment methods" backHref="/settings" backLabel="Settings" />

      <Banner error={sp.error} success={sp.success} />

      {/* No delete option — a payment method used on any historical Payment row
          can't be safely removed. Intentionally kept visible. */}
      <p className="text-xs text-text-muted">
        No delete option — a payment method that&apos;s been used on any historical Payment row
        can&apos;t be safely removed. Deactivate it instead to hide it from the Sales Terminal
        without touching past transactions.
      </p>

      <Card className="p-0">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell className="text-right">Payments recorded</TableHeaderCell>
              <TableHeaderCell className="text-right">Action</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {methods.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-text-muted">
                  No payment methods yet.
                </TableCell>
              </TableRow>
            ) : (
              methods.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium text-text">{m.name}</TableCell>
                  <TableCell>
                    <Badge variant={m.isActive ? "success" : "neutral"}>
                      {m.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-text-muted">{m._count.payments}</TableCell>
                  <TableCell className="text-right">
                    <form action={togglePaymentMethodActive.bind(null, m.id)} className="inline-block">
                      <input type="hidden" name="nextActive" value={m.isActive ? "false" : "true"} />
                      <Button type="submit" size="sm" variant={m.isActive ? "danger" : "secondary"}>
                        {m.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
