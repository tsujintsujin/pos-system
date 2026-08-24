import { prisma } from "@/lib/prisma";
import { createCustomerGroup, updateCustomerGroup, deleteCustomerGroup } from "@/app/actions/customers";
import Banner from "@/app/components/Banner";
import Card from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Button, { LinkButton } from "@/app/components/ui/Button";
import PageHeader from "@/app/components/ui/PageHeader";
import EmptyState from "@/app/components/ui/EmptyState";

export default async function CustomerGroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; edit?: string }>;
}) {
  const params = await searchParams;
  const editingId = params.edit ? Number(params.edit) : null;

  const groups = await prisma.customerGroup.findMany({
    include: { _count: { select: { customers: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Customer groups"
        subtitle={`${groups.length} group${groups.length === 1 ? "" : "s"}`}
        backHref="/customers"
        backLabel="Back to customers"
      />

      <Banner error={params.error} success={params.success} />

      <Card className="p-0">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-text">All groups</h2>
        </div>
        <div className="px-4 py-2">
          {groups.length === 0 ? (
            <EmptyState message="No customer groups yet" subMessage="Add one using the form below." />
          ) : (
            <ul className="flex flex-col">
              {groups.map((g) => (
                <li key={g.id} className="border-t border-border py-2 first:border-t-0">
                  {editingId === g.id ? (
                    <form action={updateCustomerGroup.bind(null, g.id)} className="flex flex-wrap items-center gap-2">
                      <Input name="name" defaultValue={g.name} required className="w-40" />
                      <Input
                        name="discountPercentage"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        defaultValue={g.discountPercentage.toString()}
                        className="w-24"
                      />
                      <Button type="submit" size="sm">
                        Save
                      </Button>
                      <LinkButton href="/customers/groups" variant="ghost" size="sm">
                        Cancel
                      </LinkButton>
                    </form>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="text-text">
                        {g.name} <span className="text-text-muted">— {g.discountPercentage.toString()}% discount</span>{" "}
                        <span className="text-text-muted">
                          ({g._count.customers} customer{g._count.customers === 1 ? "" : "s"})
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <LinkButton href={`/customers/groups?edit=${g.id}`} variant="secondary" size="sm">
                          Edit
                        </LinkButton>
                        <form action={deleteCustomerGroup.bind(null, g.id)}>
                          <Button type="submit" variant="danger" size="sm">
                            Delete
                          </Button>
                        </form>
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-text">Add group</h2>
        <form action={createCustomerGroup} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="text-xs font-medium text-text-muted">
              Name
            </label>
            <Input id="name" name="name" required className="w-48" placeholder="e.g. VIP" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="discountPercentage" className="text-xs font-medium text-text-muted">
              Discount %
            </label>
            <Input
              id="discountPercentage"
              name="discountPercentage"
              type="number"
              step="0.01"
              min="0"
              max="100"
              defaultValue="0"
              className="w-28"
            />
          </div>
          <Button type="submit">Add group</Button>
        </form>
      </Card>
    </div>
  );
}
