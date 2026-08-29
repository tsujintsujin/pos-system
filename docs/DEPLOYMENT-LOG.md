# Deployment & Hardening Log — 2026-08-24 to 2026-08-25

Summary of the session that took `pos-system` from a local-only, MySQL-backed dev app to a
publicly deployed app at `justin94.space/pos-system`, plus the bug fixes and hardening that
followed. Kept here as a record of *why* things are the way they are — the reasoning behind
non-obvious decisions, not a restatement of what the code already shows.

## 1. Database migration: MySQL (Docker) → PostgreSQL (Supabase)

- Local dev previously ran MySQL via Docker (`docker-compose.yml`, `pos_mysql` +
  `pos_phpmyadmin`). Deploying to Vercel needed a reachable, managed database — moved to a
  new Supabase Postgres project (separate from any other Supabase project on the account).
- `prisma/schema.prisma`: `provider = "postgresql"`.
- `lib/prisma.ts`, `prisma/seed.ts`, `prisma/seed-demo-data.ts`: swapped
  `@prisma/adapter-mariadb` → `@prisma/adapter-pg`.
- Two separate connection strings, both required:
  - `DATABASE_URL` — pooled (port 6543, `?pgbouncer=true`), used by the app's runtime
    Prisma client (`lib/prisma.ts`). Serverless/IPv4-safe.
  - `DIRECT_URL` — unpooled (port 5432), used only by `prisma.config.ts` for the CLI
    (`prisma migrate`). pgbouncer's transaction-mode pooler doesn't support the
    DDL/prepared-statement operations migrations need — using it caused `prisma migrate dev`
    to hang indefinitely rather than error cleanly.
  - Prisma 7's `@prisma/config` package's `Datasource` type has **no `directUrl` field**
    (checked directly against `node_modules/@prisma/config/dist/index.d.ts`, v7.9.1) —
    despite some doc references suggesting otherwise. `prisma.config.ts` uses `DIRECT_URL`
    as its plain `url` instead; this is correct because the config file's datasource and the
    app's runtime adapter are two independent connection configurations.
- Old MySQL-specific migrations were deleted and replaced with one fresh
  `20260824025747_init_postgres` migration (MySQL SQL syntax isn't Postgres-compatible).
- Local dev's `.env` now also points at Supabase (single source of truth, no more local
  Docker DB) — this is also why local dev sometimes hits `pool timeout` errors: the pooler's
  connection limit (10) gets shared across local dev + Vercel + any ad-hoc scripts.

## 2. Vercel deployment

- GitHub repo: `https://github.com/tsujintsujin/pos-system` (private).
- Vercel build initially failed: `Module not found: Can't resolve '@/app/generated/prisma/client'`.
  Cause: the generated Prisma client directory is (correctly) gitignored as a build artifact,
  but nothing told Vercel to regenerate it. Fix: `"postinstall": "prisma generate"` in
  `package.json`.
- Env vars set on the Vercel project: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`.

## 3. Routing under `justin94.space/pos-system`

Same multi-project proxy pattern as Dashboard/culinary-symphony/justinandjecery (see
Portfolio's `CLAUDE.md`): `pos-system` sets its own `basePath: "/pos-system"`, and
Portfolio's `next.config.ts` adds two `rewrites()` entries (exact + `:path*`) pointing at
`pos-system`'s own Vercel URL. No branch, no DNS/subdomain step — purely config.

Next's `basePath` only auto-prefixes `next/link` and router navigation. It does **not**
auto-prefix:
- Hardcoded `fetch()` calls — fixed via `lib/base-path.ts`'s `apiPath()` helper, used on
  every client-side `fetch('/api/...')` call.
- Raw `<a href="/...">` tags — several of these slipped through the initial redesign pass and
  caused real bugs (see §5). All converted to `next/link`'s `<Link>`.
- A `NextResponse.redirect(new URL('/login', request.url))` built from an absolute path in
  middleware — also had to be manually prefixed (see §5).

## 4. Next.js 16 specifics learned this session

- `middleware.ts` was renamed to `proxy.ts` in Next.js 16 (`export async function proxy(...)`,
  not `middleware`). Confirmed via `node_modules/next/dist/docs/.../proxy.md`.
- A stale Turbopack `.next` cache after adding `basePath` caused false 404s on API routes even
  after the config was correct — needs `rm -rf .next` + full dev-server restart, not just HMR.

## 5. Real bugs found and fixed (roughly chronological)

| Bug | Root cause | Fix |
|---|---|---|
| Login "just spins," submits empty body | Browser/password-manager autofill doesn't fire React's `onChange` on controlled inputs | Read via `FormData` at submit time instead of controlled state |
| Password field looked pre-filled | Placeholder was literally `"••••••••"`, visually identical to real masked input | Changed placeholder to `"Enter your password"` |
| Vercel build: module not found (Prisma client) | Gitignored generated client, nothing regenerates it on Vercel | `postinstall: "prisma generate"` |
| Every page 404s through `justin94.space/pos-system` | `proxy.ts`'s auth-redirect built `new URL("/login", request.url)` — an absolute path, so it drops `basePath` (only `redirect()`/`router.push()`/`<Link>` auto-prefix; raw `NextResponse.redirect` doesn't) | Prefix with `BASE_PATH` from `lib/base-path.ts` |
| "Switch user with PIN" / "Log in with email instead" / a void-refund receipt link all 404 | Raw `<a href="/...">` tags, not `next/link` — same basePath-prefix gap as above | Converted all three to `next/link`'s `<Link>` |
| PIN link **hangs** on tap on mobile (worked on desktop) | `/switch-user` wasn't in `proxy.ts`'s `PUBLIC_PATHS` list, so every request to it — including Next's tap-triggered RSC prefetch — got redirected to `/login`. A prefetch response that's actually a redirect breaks Next's client router, hanging the tap. Full navigation (desktop click) doesn't hit this path the same way. | Added `/switch-user` to `PUBLIC_PATHS` |
| Sales Terminal's "Dashboard" button went to a **different app** (`justin94.space/dashboard`) | Same raw-`<a href="/dashboard">` bug, three instances in `SalesTerminal.tsx` (Dashboard, Shift, Refund/return links) | Converted to `next/link` |
| Back-office unusable on mobile — sidebar ate ~64% of a 375px screen, no collapse | `Sidebar.tsx` was a fixed `w-60` (240px) column with no breakpoint variance | New `AppShell.tsx`: off-canvas drawer below `lg` (1024px), hamburger toggle, closes on nav-tap or backdrop-click; unchanged (static) at `lg`+ |
| Whole-page horizontal scroll at tablet width (768px) | Content flex child had no `min-w-0` — classic flexbox min-width overflow bug (a flex item's default `min-width: auto` lets intrinsic content width push the container wider than viewport) | Added `min-w-0` to the content wrapper |
| "Processing…" indicator disappeared before content actually loaded | A `fetch()` promise resolves when response **headers** arrive, not when the (possibly streamed, RSC/Suspense) body finishes — and product images never go through `fetch()` at all | Indicator now awaits a cloned copy of the response body to completion before decrementing, and separately tracks in-flight `<img>` loads via a `MutationObserver` |
| Product images silently broken on the public domain the whole time | Portfolio's catch-all CSP (`img-src 'self' data:`) applies to all proxied `/pos-system/*` responses too (headers from the proxying app apply regardless of where the response body comes from) — `picsum.photos` (the seed data's image host) was never in that allowlist | New dedicated CSP block for `/pos-system/:path*` with `img-src 'self' data: https:`, mirroring the exception Dashboard already had for its own images |

## 6. Security hardening (2026-08-25)

Prompted by realizing the deployed app is public (not LAN-only, the original scoping
assumption) — anyone who finds the URL can hit the auth endpoints.

- **No rate limiting existed** on `/api/auth/login`, `/api/auth/pin`, or
  `/api/returns/verify-manager-pin`. A PIN is only 4 digits (10,000 combinations) —
  brute-forceable in seconds with no lockout.
- Added `lib/rate-limit.ts`: best-effort **in-memory** lockout, keyed by client IP + endpoint
  scope (`login:`, `pin:`, `manager-pin:`) — 5 failures within a 5-minute window blocks that
  key for 5 minutes. Explicitly **not distributed**: Vercel serverless functions aren't
  guaranteed to share memory across instances, so a request that lands on a fresh cold
  instance won't see prior failures from other instances. Verified live: once the counter
  does land on a warm/consistent path, the lockout holds (`429` on all 6 rapid re-tries);
  the very first spaced-out test round showed `401` all six times instead of tripping to
  `429`, consistent with hitting different cold instances. Accepted tradeoff for the app's
  current scale — would need Redis/Upstash for a hard guarantee.

## 7. Performance: `next/image` adoption

All product/receipt/cart images were raw `<img>` tags (zero `next/image` usage anywhere) —
no lazy-loading, no layout-shift prevention. `Product.imageUrl` is an arbitrary admin-entered
URL (no upload/storage — see the product edit page), so there's no fixed host to allowlist
via `next.config.ts`'s `images.remotePatterns`. Set `images.unoptimized: true` instead —
skips Next's server-side resize/reformat proxy (which would otherwise need risky
wildcard-allowlisting) while keeping `next/image`'s lazy-loading and reserved-dimension
layout-shift prevention. Converted the four highest-traffic spots: Sales Terminal's product
grid (`ProductGrid.tsx`, `fill` + `sizes`), the back-office products table
(`(catalog)/products/page.tsx`, 32×32), the product edit preview
(`(catalog)/products/[id]/page.tsx`, 64×64), and cart line thumbnails (`CartTable.tsx`,
56×56). Left `Receipt.tsx` (print-layout risk) and the store-profile logo (single image,
negligible perf impact) as plain `<img>`.

## 8. Responsive audit (`/ux-ui-responsive`)

Findings written up separately at `docs/ui/responsive/back-office-sidebar.md`. Summary: the
back-office shell (sidebar + tablet-width overflow) was the only real gap — Sales
Terminal/Returns/PIN screens were already mobile-first and needed no changes.

## 9. Known open items (not yet done, flagged but not requested)

- **Demo-data seed never finished** — last known count: 12/180 sample sales, 3/27 shifts.
  Dashboard analytics (`₱0.00 total sales`, `0 transactions`) will look sparse for a demo
  until this is re-run and completes.
- **No pagination** on Products/Customers/Inventory list pages (`findMany` with no
  `take`/`skip`) — fine at the current ~52-SKU catalog size, will degrade as it grows.
- **No automated tests** anywhere in the project — no test framework configured.
- **No `.env.example`** — required env vars (`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`) are
  only discoverable by reading `lib/prisma.ts` / `proxy.ts`.

## Access (for reference)

- Live: `https://justin94.space/pos-system`
- Login: `admin@possystem.local` / `admin123`
- PIN quick-switch: `1234` (same admin account)
