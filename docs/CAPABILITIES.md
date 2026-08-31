# POS System — Capabilities

A full-stack point-of-sale and back-office application for a small retail store. It covers the
whole loop: a cashier-facing terminal for ringing up sales, a returns/refunds desk, cash drawer
and shift reconciliation, catalog and inventory management, purchasing, customers, and a
reporting layer with CSV export.

**Stack:** Next.js 16 (App Router, Server Actions, Turbopack) · React 19 · Tailwind CSS 4 ·
Prisma 7 → PostgreSQL (Supabase) · `jose` JWT sessions · bcrypt · Vercel Blob for images.
Deployed on Vercel (`syd1`, co-located with the database) and served under
`justin94.space/pos-system` via `basePath` plus a rewrite from the Portfolio app.

**Design principle running through the whole app:** the client is for speed, the server is the
source of truth. Cart math runs locally for instant feedback, then every total is *re-derived
from raw line items* server-side before anything is written — client-sent aggregates are never
trusted. Stock and cash always move as a ledger row (`StockMovement`, `CashMovement`) plus a
balance update, inside one transaction.

---

## 1. Authentication, roles & access control

| Capability | Detail |
|---|---|
| Email + password login | bcrypt hashes, 12-hour signed JWT in an httpOnly `sameSite=lax` cookie |
| PIN quick-switch | On-screen keypad at `/switch-user`; swaps the session to another cashier with no logout round trip — built for a shared terminal |
| Idle auto-lock | 5 minutes of no input on any terminal screen redirects to the PIN lock screen; resuming reuses the same PIN flow |
| Role permissions | Six boolean flags on `Role`: `canAccessBackOffice`, `canOverridePrice`, `canApproveRefund`, `canVoidAfterCompletion`, `canManageUsers`, `canManageSettings` |
| Seeded roles | `ADMIN`, `MANAGER`, `CASHIER`, `DEMO` |
| Route protection | `proxy.ts` does a cheap JWT signature check on every request; DB-backed permission checks live in the pages and actions themselves via `requireRole()` |
| Public read-only demo | One-click demo login. Safety comes from the `DEMO` role holding no permission flags **and** the proxy rejecting every non-GET request from a DEMO session (logout excepted) — one choke point rather than 34 individual guards |
| Brute-force guard | In-memory IP+scope lockout on `/api/auth/login`, `/api/auth/pin`, `/api/returns/verify-manager-pin`: 5 failures in 5 minutes triggers a 5-minute block |
| Audit log | `AuditLog` rows with actor, action, entity, and before/after JSON snapshots |
| Time clock | Clock-in / clock-out entries recorded automatically when a shift is opened and closed |

---

## 2. Sales terminal (`/sales`)

The cashier-facing checkout screen. Requires an open shift — otherwise it redirects to `/shift`.

**Building the cart**

- Persistent product grid over the full active catalog, fetched once server-side and filtered
  client-side as you type (no per-keystroke round trip).
- Search by name, SKU, or barcode; scanner input works as plain keyboard entry.
- Quantity edits, line removal, and running totals all computed locally for instant feedback.
- Line thumbnails from the product image.

**Pricing & tax**

- Each line resolves its own tax rate and inclusive/exclusive flag from the product's tax class,
  falling back to the store default.
- **Inclusive tax** is backed out for display only and never added twice to the total;
  **exclusive tax** is added on top.
- A cart-level discount (percentage or fixed) is distributed across lines *proportional to each
  line's share of the pre-discount subtotal*, so tax is computed on the correct post-discount
  base per line — correct even when lines carry different rates.
- Quick-pick from active CART-scoped discounts configured in Settings, or an ad-hoc amount.
- Optional cash rounding to a configured increment (e.g. nearest ₱1) applied to tendering only —
  the ledger total stays exact.

**Customers**

- Attach a customer by search (name / phone / email), or quick-add a new one inline from a modal.
- Attaching a customer unlocks store-credit tendering.

**Park / resume**

- Hold a sale mid-cart and start another; parked sales list in a side panel with resume and void.
- Parked sales carry a throwaway receipt number and are re-stamped with the real sequential number
  and the *current* shift when completed.

**Payment**

- Split tender: add as many payment rows as needed, each with its own method and amount.
- Cash rows take an amount-tendered and compute change.
- Seeded methods: **Cash, GCash, Card, Store Credit** — activatable/deactivatable in Settings.
- Store credit is modelled as an ordinary payment line against a `Store Credit` payment-method row;
  the redemption is validated against the customer's *current DB balance inside the same
  transaction*, never a client-sent figure.
- The server rejects the sale unless the payment rows sum to the re-derived grand total to the cent.

**Completion**

- Sequential, never-reused receipt numbers: `L{location}-R{register}-{000000}`, derived from the
  auto-increment sale id so a voided number can never be recycled.
- Stock deducts **only at completion** (never on cart-add or park): one `StockMovement` plus an
  `Inventory` update per stock-tracked line, in the same transaction as the sale and payments.
- On-screen, printable receipt with store logo, address, line detail, tax breakdown, tender and
  change, plus configurable footer text.

---

## 3. Returns & refunds (`/returns`)

- Look up the original sale by receipt number.
- Choose **per-line return quantities** — partial returns are first-class — with a per-line
  "restock?" toggle.
- Refund methods: **original payment method**, **cash**, or **store credit**.
- Store credit credits the customer's balance, and is blocked unless the original sale has a
  customer attached.
- Cash refunds require an open shift.
- **Manager approval gate:** refunds over ₱500 require a manager PIN unless the acting cashier's
  own role already carries `canApproveRefund`. The PIN is re-verified server-side on submit — a
  client-side "approved" flag is never trusted on its own.
- Cumulative returned quantity across *all* returns for that sale determines whether the sale flips
  to `PARTIALLY_REFUNDED` or `REFUNDED`.
- Restocked lines write a positive `StockMovement` (`reason: RETURN`) plus the inventory increment.
- Printable return receipt.

**Voids**

- Void a parked sale outright.
- Cancel a *completed* receipt (gated on `canVoidAfterCompletion`) from the Void & Refund report —
  restocks every tracked line and writes an audit-log entry with the before/after state.

---

## 4. Shifts & cash drawer (`/shift`)

- Open a shift with an opening float; one open shift per user at a time.
- Cash movements during the shift: **paid-in**, **paid-out**, **safe drop**, each with a reason.
- **X-report** — live read-only snapshot of the open shift.
- **Z-report** — the equivalent for a closed shift.
- Reconciliation math: `expected cash = opening float + cash sales + paid-in − paid-out − safe drops`.
  Only COMPLETED sales count. The closing count is entered at close and the variance is persisted.
- Sales breakdown by payment method, transaction count, and gross total per shift.
- Opening and closing a shift also opens and closes the cashier's time-clock entry.

---

## 5. Catalog

**Products** — SKU, barcode, name, description, category, tax class, cost price, sell price, image,
active flag, stock-tracking flag, and a reorder threshold.

- **Image upload** to Vercel Blob (≤5 MB; JPEG/PNG/WebP/GIF/AVIF), or paste an externally hosted URL.
- **Variants** — alternate sell-units of the same product (a case of 24 vs. a single piece, or a
  size/colour). Each has its own SKU, optional barcode, optional price override, and a
  `unitsPerParent` conversion back to the base stock unit.
- **Composite / bundle products** — a product built from other products, with per-component
  quantities.

**Categories** — nestable parent/child tree.

**Tax classes** — named rate with an inclusive/exclusive flag, assignable per product, with a
store-wide default.

---

## 6. Inventory

- Quantity on hand tracked per location, per product, per variant.
- **Manual adjustments** with a reason code: `ADJUSTMENT`, `DAMAGE`, `THEFT`, `EXPIRY`,
  `COUNT_CORRECTION`, `TRANSFER`.
- Every movement — sale, return, receiving, adjustment — writes an immutable `StockMovement` row
  alongside the balance change, so the ledger fully explains the current quantity.
- **Reorder alerts** driven by each product's reorder threshold.
- **Slow-moving stock** detection.

---

## 7. Purchasing

- **Suppliers** with contact info and payment terms.
- **Purchase orders** with a status lifecycle: `DRAFT → ORDERED → PARTIAL → RECEIVED`, plus
  `CANCELLED`.
- Line items track quantity ordered, quantity received, and unit cost separately.
- **Partial receiving** — receive line by line; each receipt increments inventory and writes a
  `RECEIVING` stock movement, and the PO status advances to `PARTIAL` or `RECEIVED` accordingly.

---

## 8. Customers

- Customer records with name, unique phone, email, loyalty points balance, and store credit balance.
- **Customer groups** with an associated discount percentage.
- Per-customer detail page with purchase history.
- Quick-add from the sales terminal without leaving the cart.

---

## 9. Reporting

Eight reports, each date-range filtered and **exportable to CSV**:

| Report | Contents |
|---|---|
| Sales summary | Totals, daily breakdown, split by payment method |
| Product performance | Best and worst sellers by quantity and revenue, plus a per-product sales series over 7d / 30d / 90d / 12mo |
| Sales by category | Quantity and revenue grouped by category |
| Tax | Taxable base and tax collected, broken out by rate |
| Void & refund | Voided sales and refunds, with the cancel-receipt action |
| Shift reconciliation | Per-shift float, sales, movements, expected vs. counted, variance |
| Inventory valuation | On-hand quantity valued at cost and at retail |
| Inventory history | The full stock-movement ledger, filterable by reason |

**Dashboard** (`/dashboard`) — a question-led overview with quick date ranges and
period-over-period comparison: headline stat cards, a daily sales line chart, sales by hour and by
weekday, a category donut, a top-products bar chart, reorder alerts, and slow-moving stock. All
charts are hand-rolled SVG — no charting library.

---

## 10. Settings & administration

- **Store profile** — name, address, currency symbol, cash rounding increment, receipt logo,
  receipt footer text.
- **Locations & registers** — create locations and registers, toggle registers active. (The data
  model is fully multi-location; v1 operates as a single store.)
- **Tax classes** — create and edit rates and the inclusive flag.
- **Payment methods** — activate and deactivate.
- **Discounts** — percentage or fixed, scoped to product / category / cart, with optional start and
  end dates and an active toggle.
- **Staff** — create and edit users, assign role and location, deactivate, set or remove a PIN.

---

## 11. Back-office UX

- Collapsible sidebar: an icon rail at desktop widths, an off-canvas drawer below `lg`.
- Every list table (products, customers, inventory, receipts, staff, suppliers, purchase orders…)
  supports **server-side pagination, sorting, and case-insensitive live filtering** — all driven
  through URL search params so the state is shareable and back-button safe, and all executed in
  Postgres rather than in the browser.
- Global top-right processing indicator that waits for streamed response bodies *and* in-flight
  image loads before clearing.
- A banner marking the read-only demo session.

---

## 12. Known gaps & deliberate non-goals

Recorded so nobody mistakes them for bugs:

- **No live payment gateway.** `Payment` records the tender; `referenceNumber` is reserved for a
  future gateway auth code or GCash reference. Nothing is charged electronically.
- **Loyalty points** are stored on the customer but there is no earn or redeem flow yet.
- **Customer-group discount percentages** are stored but not auto-applied at checkout — the cashier
  applies discounts manually.
- **PRODUCT- and CATEGORY-scoped discounts** can be created and managed for record-keeping, but only
  CART-scoped discounts are enforced at the terminal.
- **`Return` has no `shiftId`.** Cash refunds are gated on an open shift but cannot be attributed to
  one, so refund cash-outs do not appear in X/Z reports. Fixing this needs a migration.
- **The rate limiter is in-memory**, so it is best-effort on serverless — it stops a script hammering
  one warm instance, not a distributed attempt. A hard guarantee needs Redis/Upstash.
- **Multi-location is modelled but not exercised** — the terminal is pinned to location 1 /
  register 1.
- **No automated tests** are configured.
