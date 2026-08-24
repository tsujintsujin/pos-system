/**
 * Minimal inline stroke-based icon set (Heroicons-style paths). Never emoji.
 * Kept here rather than pulling in an icon library dependency.
 */

export function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z"
      />
    </svg>
  );
}

export function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function InboxIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 9.75 5.25 4.5h13.5L21 9.75M3 9.75v8.25A1.5 1.5 0 0 0 4.5 19.5h15a1.5 1.5 0 0 0 1.5-1.5V9.75M3 9.75h5.25a.75.75 0 0 1 .75.75 2.25 2.25 0 0 0 4.5 0 .75.75 0 0 1 .75-.75H21" />
    </svg>
  );
}

/** Idle-lock indicator for the PIN resume screen. */
export function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4.5" y="10.5" width="15" height="9.75" rx="1.5" />
      <path d="M7.5 10.5V7.5a4.5 4.5 0 0 1 9 0v3" />
    </svg>
  );
}

/** Keypad backspace/delete-last-digit control (PIN entry screens). */
export function BackspaceIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 6.75h9.75a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-1.5 1.5H9L3.75 12 9 6.75Z" />
      <path d="M14.25 9.75 10.5 13.5m0-3.75 3.75 3.75" />
    </svg>
  );
}

/** Sales Terminal: cart / parked-sales affordances. */
export function CartIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.435m0 0L7.5 14.25a1.5 1.5 0 0 0 1.45 1.125h7.6a1.5 1.5 0 0 0 1.45-1.125l1.5-6.75H5.106m0 0L4.5 5.27" />
      <circle cx="9" cy="19.5" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="17.25" cy="19.5" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Remove-line / discard-cart action. */
export function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.5 6.75h15M9.75 6.75V4.5a1.5 1.5 0 0 1 1.5-1.5h1.5a1.5 1.5 0 0 1 1.5 1.5v2.25M18 6.75l-.66 12.03a2.25 2.25 0 0 1-2.245 2.13H8.905a2.25 2.25 0 0 1-2.245-2.13L6 6.75" />
    </svg>
  );
}

/** Qty stepper. */
export function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** Qty stepper. */
export function MinusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
    </svg>
  );
}

/** Product/customer search input. */
export function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="10.5" cy="10.5" r="6.75" />
      <path d="M20.25 20.25 15.8 15.8" />
    </svg>
  );
}

/** Customer picker. */
export function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.75 20.25a7.25 7.25 0 0 1 14.5 0" />
    </svg>
  );
}

/** Discount control. */
export function TagIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11.03 3.75H6a2.25 2.25 0 0 0-2.25 2.25v5.03c0 .597.237 1.169.659 1.591l8.69 8.69a1.5 1.5 0 0 0 2.122 0l6.408-6.408a1.5 1.5 0 0 0 0-2.122l-8.69-8.69a2.25 2.25 0 0 0-1.59-.659Z" />
      <circle cx="8.25" cy="8.25" r="1.125" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Cash payment method tab. */
export function CashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2.25" y="6" width="19.5" height="12" rx="1.5" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M5.25 9v0M18.75 15v0" />
    </svg>
  );
}

/** Card payment method tab. */
export function CardIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2.25" y="5.25" width="19.5" height="13.5" rx="1.5" />
      <path d="M2.25 9.75h19.5M5.25 15h4.5" />
    </svg>
  );
}

/** Generic wallet/e-payment method tab (GCash etc.). */
export function WalletIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 7.5A2.25 2.25 0 0 1 5.25 5.25h13.5A2.25 2.25 0 0 1 21 7.5v9a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 16.5v-9Z" />
      <path d="M15.75 12.75h2.25a.75.75 0 0 0 .75-.75v-1.5a.75.75 0 0 0-.75-.75H15.75a1.5 1.5 0 0 0 0 3Z" />
    </svg>
  );
}

/** Printer action on the receipt stage. */
export function PrinterIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6.75 8.25V4.5a.75.75 0 0 1 .75-.75h9a.75.75 0 0 1 .75.75v3.75" />
      <rect x="3" y="8.25" width="18" height="8.25" rx="1.5" />
      <rect x="6.75" y="13.5" width="10.5" height="6.75" rx="0.75" />
    </svg>
  );
}

/** Success confirmation (receipt stage / completed sale). */
export function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m8.25 12.75 2.25 2.25 5.25-5.25" />
    </svg>
  );
}

/** Product/catalog affordance (product list, product edit header). */
export function BoxIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.75 8.25 12 3.75l8.25 4.5-8.25 4.5-8.25-4.5Z" />
      <path d="M3.75 8.25v7.5L12 20.25l8.25-4.5v-7.5" />
      <path d="M12 12.75v7.5" />
    </svg>
  );
}

/** Category tree / folder affordance. */
export function FolderIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.75 6.75A1.5 1.5 0 0 1 5.25 5.25h4.19c.4 0 .78.159 1.06.44l1.31 1.31h6.94a1.5 1.5 0 0 1 1.5 1.5v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V6.75Z" />
    </svg>
  );
}

/** Low-stock / negative-stock alert flag. */
export function WarningTriangleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.29 2.25h17.78A1.5 1.5 0 0 0 22.18 18L13.71 3.86a1.5 1.5 0 0 0-2.58 0Z" />
      <path d="M12 9v4.5M12 16.5v0" />
    </svg>
  );
}

/** Edit/pencil action (category tree inline edit). */
export function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16.862 4.487a1.875 1.875 0 1 1 2.652 2.652L7.5 19.15l-4 1 1-4L16.862 4.487Z" />
    </svg>
  );
}

/** Close / dismiss control for popovers and modals. */
export function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

/** CSV export action on report pages. */
export function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3.75v11.25m0 0 3.75-3.75M12 15 8.25 11.25" />
      <path d="M4.5 16.5v2.25a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V16.5" />
    </svg>
  );
}

/** Location / store affordance (settings hub, locations list). */
export function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4.5" y="3.75" width="10.5" height="16.5" rx="1" />
      <path d="M15 9.75h4.5a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H15" />
      <path d="M7.5 7.5h1.5M7.5 11.25h1.5M7.5 15h1.5M10.5 7.5H12M10.5 11.25H12M10.5 15H12" />
      <path d="M9 20.25v-3h1.5v3" />
    </svg>
  );
}

/** Dashboard/home landing affordance (sidebar nav). */
export function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.25 9v9.75a1.5 1.5 0 0 0 1.5 1.5h10.5a1.5 1.5 0 0 0 1.5-1.5V9" />
      <path d="M9.75 20.25v-6h4.5v6" />
    </svg>
  );
}

/** Analytics/reports affordance (sidebar nav, dashboard chart panel). */
export function ChartBarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.75 20.25h16.5" />
      <rect x="5.25" y="12" width="3" height="8.25" rx="0.5" />
      <rect x="10.5" y="7.5" width="3" height="12.75" rx="0.5" />
      <rect x="15.75" y="3.75" width="3" height="16.5" rx="0.5" />
    </svg>
  );
}

/** Return / arrow-turn affordance (sidebar Returns nav item). */
export function ReturnArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 14.25 4.5 9.75 9 5.25" />
      <path d="M4.5 9.75h9a5.25 5.25 0 0 1 5.25 5.25v.75" />
    </svg>
  );
}

/** Truck/supplier delivery affordance. */
export function TruckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2.25" y="6.75" width="11.25" height="9" rx="1" />
      <path d="M13.5 10.5h3.586a1 1 0 0 1 .74.328l2.414 2.646a1 1 0 0 1 .26.672v2.104a1 1 0 0 1-1 1H19.5" />
      <circle cx="7" cy="18.75" r="1.5" />
      <circle cx="17" cy="18.75" r="1.5" />
    </svg>
  );
}

/** Clipboard/purchase-order document affordance. */
export function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5.25" y="4.5" width="13.5" height="16.5" rx="1.5" />
      <path d="M9 4.5V3.75a1.5 1.5 0 0 1 1.5-1.5h3a1.5 1.5 0 0 1 1.5 1.5V4.5" />
      <path d="M8.25 10.5h7.5M8.25 14.25h7.5M8.25 18h4.5" />
    </svg>
  );
}

/** Staff/team affordance (multiple users). */
export function UsersIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="8.25" r="3" />
      <path d="M2.25 20.25a6.75 6.75 0 0 1 13.5 0" />
      <path d="M15.75 8.25a2.75 2.75 0 1 1 0 5.5" />
      <path d="M17.25 14.75a5.25 5.25 0 0 1 4.5 5.5" />
    </svg>
  );
}

/** Time/shift clock affordance. */
export function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 1.75" />
    </svg>
  );
}

/** Sidebar collapse / switch-user affordance (arrow through a doorway). */
export function LogoutArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 20.25H5.25a1.5 1.5 0 0 1-1.5-1.5V5.25a1.5 1.5 0 0 1 1.5-1.5H9" />
      <path d="M15.75 15.75 20.25 12l-4.5-3.75" />
      <path d="M20.25 12H9" />
    </svg>
  );
}

/** Stock levels / stacked inventory affordance (sidebar Inventory nav item). */
export function StackIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 3.75 8.25 4.5-8.25 4.5-8.25-4.5L12 3.75Z" />
      <path d="m3.75 12.75 8.25 4.5 8.25-4.5" />
      <path d="m3.75 17.25 8.25 4.5 8.25-4.5" />
    </svg>
  );
}

/** Barcode-scan affordance (Sales Terminal search bar). */
export function BarcodeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.5 5.25v13.5M8.25 5.25v13.5M11 5.25v13.5M14 5.25v13.5M16.5 5.25v13.5M19.5 5.25v13.5" />
      <path d="M3 3.75h2.25M18.75 3.75H21M3 20.25h2.25M18.75 20.25H21" />
    </svg>
  );
}

/** Settings hub / configuration affordance. */
export function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.63.24 1.51.99 1.51 1v.09a2 2 0 0 1 0 4H21a1.65 1.65 0 0 0-1.6 1Z" />
    </svg>
  );
}
