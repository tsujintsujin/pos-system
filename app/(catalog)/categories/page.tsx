import { prisma } from "@/lib/prisma";
import { createCategory, updateCategory, deleteCategory } from "@/app/actions/categories";
import Banner from "@/app/components/Banner";
import Card from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";
import Select from "@/app/components/ui/Select";
import Button, { LinkButton } from "@/app/components/ui/Button";
import PageHeader from "@/app/components/ui/PageHeader";
import EmptyState from "@/app/components/ui/EmptyState";
import { FolderIcon, PencilIcon } from "@/app/components/ui/icons";

type CategoryRow = { id: number; name: string; parentId: number | null };

function buildTree(categories: CategoryRow[]) {
  const byParent = new Map<number | null, CategoryRow[]>();
  for (const c of categories) {
    const list = byParent.get(c.parentId) ?? [];
    list.push(c);
    byParent.set(c.parentId, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  return byParent;
}

function CategoryTree({
  byParent,
  parentId,
  depth,
  editingId,
  allCategories,
}: {
  byParent: Map<number | null, CategoryRow[]>;
  parentId: number | null;
  depth: number;
  editingId: number | null;
  allCategories: CategoryRow[];
}) {
  const children = byParent.get(parentId) ?? [];
  if (children.length === 0) return null;

  return (
    <ul className="flex flex-col">
      {children.map((cat) => (
        <li key={cat.id} className="border-t border-border first:border-t-0">
          {editingId === cat.id ? (
            <form
              action={updateCategory.bind(null, cat.id)}
              className="flex flex-wrap items-center gap-2 py-2.5"
              style={{ paddingLeft: depth * 20 }}
            >
              <Input name="name" defaultValue={cat.name} required className="w-48" />
              <Select name="parentId" defaultValue={cat.parentId ?? ""} className="w-56">
                <option value="">No parent (top-level)</option>
                {allCategories
                  .filter((c) => c.id !== cat.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </Select>
              <Button type="submit" size="sm">
                Save
              </Button>
              <LinkButton href="/categories" variant="ghost" size="sm">
                Cancel
              </LinkButton>
            </form>
          ) : (
            <div
              className="flex items-center justify-between gap-2 py-2.5 text-sm"
              style={{ paddingLeft: depth * 20 }}
            >
              <span className="flex items-center gap-2 text-text">
                <FolderIcon className="h-4 w-4 text-text-muted" />
                {cat.name}
              </span>
              <span className="flex items-center gap-2">
                <LinkButton href={`/categories?edit=${cat.id}`} variant="secondary" size="sm">
                  <PencilIcon className="h-3.5 w-3.5" />
                  Edit
                </LinkButton>
                <form action={deleteCategory.bind(null, cat.id)}>
                  <Button type="submit" variant="danger" size="sm">
                    Delete
                  </Button>
                </form>
              </span>
            </div>
          )}
          <CategoryTree
            byParent={byParent}
            parentId={cat.id}
            depth={depth + 1}
            editingId={editingId}
            allCategories={allCategories}
          />
        </li>
      ))}
    </ul>
  );
}

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; edit?: string }>;
}) {
  const params = await searchParams;
  const editingId = params.edit ? Number(params.edit) : null;

  const categories = await prisma.category.findMany({
    select: { id: true, name: true, parentId: true },
    orderBy: { name: "asc" },
  });

  const byParent = buildTree(categories);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Categories" subtitle={`${categories.length} categor${categories.length === 1 ? "y" : "ies"}`} />

      <Banner error={params.error} success={params.success} />

      <Card className="p-0">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-text">All categories</h2>
        </div>
        <div className="px-4 py-2">
          {categories.length === 0 ? (
            <EmptyState message="No categories yet" subMessage="Add one using the form below." />
          ) : (
            <CategoryTree
              byParent={byParent}
              parentId={null}
              depth={0}
              editingId={editingId}
              allCategories={categories}
            />
          )}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-text">Add category</h2>
        <form action={createCategory} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="text-xs font-medium text-text-muted">
              Name
            </label>
            <Input id="name" name="name" required className="w-56" placeholder="e.g. Beverages" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="parentId" className="text-xs font-medium text-text-muted">
              Parent category
            </label>
            <Select id="parentId" name="parentId" className="w-56" defaultValue="">
              <option value="">No parent (top-level)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit">Add category</Button>
        </form>
      </Card>
    </div>
  );
}
