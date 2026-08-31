import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import PageHeader from "@/app/components/ui/PageHeader";
import Badge from "@/app/components/ui/Badge";
import ReportBuilderClient from "@/app/components/report-builder/ReportBuilderClient";

/**
 * Report builder — the self-service counterpart to the fixed reports under /reports.
 * Those answer questions we anticipated; this one lets an admin assemble one we didn't,
 * then pin the result to the dashboard.
 *
 * Reads live POS data. The query layer emits SELECT only — building a visual never writes.
 */
export default async function ReportBuilderPage() {
  const gate = await requireRole("canAccessBackOffice");
  if (!gate.ok) {
    redirect(`/dashboard?error=${encodeURIComponent(gate.message)}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reports Visualizer"
        subtitle="Build a visual from your POS data, then publish it to the dashboard."
        actions={<Badge variant="warning">Draft</Badge>}
      />
      <ReportBuilderClient />
    </div>
  );
}
