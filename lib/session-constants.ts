// Kept in its own zero-dependency module so `proxy.ts` (which must stay lightweight —
// see node_modules/next/dist/docs .../proxy.md) can import just the cookie name without
// pulling in lib/auth.ts's Prisma/mariadb-adapter import graph.
export const SESSION_COOKIE_NAME = "pos_session";
