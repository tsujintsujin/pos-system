import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { JWTPayload } from "jose";
import { prisma } from "@/lib/prisma";
import type { RoleName } from "@/app/generated/prisma/enums";
import type { RoleModel } from "@/app/generated/prisma/models";
import { SESSION_COOKIE_NAME } from "@/lib/session-constants";

export { SESSION_COOKIE_NAME };

/** The subset of Role fields that are boolean permission flags (see prisma/schema.prisma). */
export type RolePermission = Extract<
  keyof RoleModel,
  | "canAccessBackOffice"
  | "canOverridePrice"
  | "canApproveRefund"
  | "canVoidAfterCompletion"
  | "canManageUsers"
  | "canManageSettings"
>;

const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set — add it to .env");
  }
  return new TextEncoder().encode(secret);
}

/** Shape of the data we store inside the signed session JWT / cookie. */
export interface SessionPayload extends JWTPayload {
  userId: number;
  roleId: number;
  roleName: RoleName;
  locationId: number | null;
}

/** Sign a session payload into a compact JWT string. Edge + Node compatible (jose). */
export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

/** Verify a session JWT string. Returns null if missing/invalid/expired. Safe to call from proxy (edge runtime). */
export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Set the session cookie on the current response (Route Handler / Server Action context).
 * httpOnly, sameSite=lax, secure in production.
 */
export async function setSessionCookie(payload: SessionPayload) {
  const token = await signSession(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/** Read + verify the session cookie from within a Server Component / Route Handler (Node runtime). */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySession(token);
}

/**
 * Load the full current user (with role) for the active session, or null if not logged in
 * or the user/role no longer exists / was deactivated.
 */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { role: true, location: true },
  });

  if (!user || !user.active) return null;
  return user;
}

/**
 * Server-side permission gate for API routes / server actions.
 * Pass one of the boolean flags on the Role model (e.g. "canManageUsers").
 * Throws-free: returns { ok: true, user } or { ok: false, status, message }.
 */
export async function requireRole(permission: RolePermission) {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false as const, status: 401, message: "Not authenticated" };
  }

  const hasPermission = Boolean(user.role[permission]);
  if (!hasPermission) {
    return { ok: false as const, status: 403, message: "Forbidden — insufficient role permissions" };
  }

  return { ok: true as const, user };
}
