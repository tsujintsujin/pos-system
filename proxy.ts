import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE_NAME } from "@/lib/session-constants";
import { BASE_PATH } from "@/lib/base-path";

// Note: `middleware.ts` was renamed to `proxy.ts` in Next.js 16 — see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
// Proxy defaults to the Node.js runtime in Next 16, but we still only do a lightweight
// JWT signature check here (jose, no bcryptjs/Prisma) — DB-backed permission checks
// belong in the route handlers/pages themselves (see lib/auth.ts requireRole()).

const PUBLIC_PATHS = ["/login", "/switch-user"];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith("/api/auth/")) return true;
  return false;
}

/** Returns the verified session's role name, or null when there is no valid session. */
async function getSessionRole(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return typeof payload.roleName === "string" ? payload.roleName : null;
  } catch {
    return null;
  }
}

// The demo account must never write. Enforcing that here rather than in each
// handler is deliberate: there are 20 API routes and 14 server-action modules,
// and a per-call-site guard only has to be forgotten once to make the public
// demo writable. Server Actions are POSTs too, so a method check catches them
// as well. Read methods stay untouched.
const DEMO_SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
// Logging out is a POST, and a demo user must always be able to leave.
const DEMO_ALLOWED_WRITE_PATHS = ["/api/auth/logout"];

function isDemoWriteBlocked(pathname: string, method: string): boolean {
  if (DEMO_SAFE_METHODS.has(method)) return false;
  return !DEMO_ALLOWED_WRITE_PATHS.includes(pathname);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const roleName = await getSessionRole(request);
  if (!roleName) {
    const loginUrl = new URL(`${BASE_PATH}/login`, request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (roleName === "DEMO" && isDemoWriteBlocked(pathname, request.method)) {
    return NextResponse.json(
      {
        error: "demo_read_only",
        message: "This is a read-only demo. Sign in with a real account to make changes.",
      },
      { status: 403 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Run on everything except:
     * - _next/static, _next/image (build assets)
     * - favicon.ico and other public static files with an extension
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
