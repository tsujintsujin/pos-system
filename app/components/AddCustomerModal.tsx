"use client";

import { useEffect, useState } from "react";
import { createCustomer } from "@/app/actions/customers";
import Input from "@/app/components/ui/Input";
import Select from "@/app/components/ui/Select";
import Button from "@/app/components/ui/Button";
import { PlusIcon } from "@/app/components/ui/icons";

/**
 * "Add customer" as a dialog instead of the always-visible quick-add card that used to
 * sit under the customer table. Same `createCustomer` server action and same fields —
 * only the presentation changed, so the action still handles validation, the duplicate-
 * phone case, and the redirect to the new customer's profile.
 *
 * Overlay/backdrop-click/Escape behaviour mirrors ManagerPinModal.
 */
export default function AddCustomerModal({
  customerGroups,
}: {
  customerGroups: { id: number; name: string }[];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <PlusIcon className="h-4 w-4" />
        Add customer
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-customer-title"
            className="w-full max-w-md rounded-lg bg-surface p-6 shadow-lg"
          >
            <h2 id="add-customer-title" className="font-heading text-lg font-semibold text-text">
              Add customer
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Only a name is required — phone, email and group can be filled in later.
            </p>

            <form action={createCustomer} className="mt-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="modal-name" className="text-xs font-medium text-text-muted">
                  Name <span className="text-danger">*</span>
                </label>
                <Input id="modal-name" name="name" required autoFocus placeholder="e.g. Maria Santos" />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="modal-phone" className="text-xs font-medium text-text-muted">
                  Phone
                </label>
                <Input id="modal-phone" name="phone" placeholder="e.g. 09171234567" />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="modal-email" className="text-xs font-medium text-text-muted">
                  Email
                </label>
                <Input
                  id="modal-email"
                  name="email"
                  type="email"
                  placeholder="e.g. maria@example.com"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="modal-customerGroupId" className="text-xs font-medium text-text-muted">
                  Group
                </label>
                <Select id="modal-customerGroupId" name="customerGroupId" defaultValue="">
                  <option value="">None</option>
                  {customerGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add customer</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
