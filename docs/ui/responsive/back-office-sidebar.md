# Responsive review — back-office shell

## Findings

1. **Sidebar had no mobile collapse** (`app/components/Sidebar.tsx`). It rendered as a
   fixed `w-60` (240px) column with no breakpoint variance, so on a 375px phone it ate
   ~64% of the viewport and clipped all main content (title, action buttons, stat cards
   cut off, no visible scroll affordance). Confirmed via live screenshot at 375×812.
2. **Whole-page horizontal scroll at tablet width (768px)** on catalog/report pages.
   Root cause: the content flex child (`app/(catalog)/layout.tsx`,
   `app/dashboard/layout.tsx`) had no `min-w-0`, so a flex item's default
   `min-width: auto` let its intrinsic content width (stat-card row, filter row) push
   the whole flex container wider than the viewport — the classic flexbox min-width
   overflow bug. `Table` (`app/components/ui/Table.tsx`) already wraps in its own
   `overflow-x-auto`, so this wasn't a table-specific issue.
3. **Sales Terminal / Returns / PIN screens were already fine** — confirmed at 375px:
   product grid reflows to 2 columns, search bar full width, no clipping, no horizontal
   scroll. These were built mobile-first from the start per the original design pass.

## Fix

- New `app/components/AppShell.tsx` (client component): below `lg` (1024px) the
  sidebar becomes an off-canvas drawer (fixed, `-translate-x-full` when closed,
  backdrop overlay, closes on nav-link tap or backdrop click) opened via a mobile top
  bar with a hamburger button (new `MenuIcon` in `app/components/ui/icons.tsx`). At
  `lg`+ it's `static`/always-visible, matching the previous desktop behavior exactly.
- Added `min-w-0` to the content flex child to stop the tablet-width horizontal
  overflow.
- `app/dashboard/layout.tsx` and `app/(catalog)/layout.tsx` both now render
  `<AppShell>` instead of duplicating the raw `<Sidebar>` + flex-div structure.
- `Sidebar` gained an optional `onNavigate` prop (called on link click) so `AppShell`
  can close the drawer after navigation.

## Not changed

Sales Terminal / Returns / PIN screens — already responsive, no changes needed.
