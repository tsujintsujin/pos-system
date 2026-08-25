import "server-only";

/**
 * Best-effort in-memory brute-force guard for the login/PIN endpoints, keyed by client IP
 * + a scope string (so a login lockout doesn't also block that IP's PIN attempts, etc).
 *
 * Not distributed — Vercel serverless functions aren't guaranteed to share memory across
 * instances/regions, so a determined attacker spreading requests across cold starts could
 * partially evade this. Accepted tradeoff for now: this stops the common case (a script
 * hammering one warm connection) without adding an external store (Redis/Upstash) for what's
 * currently a small single-location deployment. Revisit if this ever needs to be airtight.
 */
interface Bucket {
  failures: number;
  windowStartedAt: number;
  blockedUntil: number | null;
}

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 5 * 60 * 1000;
const MAX_FAILURES = 5;
const BLOCK_MS = 5 * 60 * 1000;

/** Periodic sweep so `buckets` doesn't grow unbounded over the process lifetime. */
function sweepExpired(now: number) {
  for (const [key, bucket] of buckets) {
    const windowExpired = now - bucket.windowStartedAt > WINDOW_MS;
    const blockExpired = !bucket.blockedUntil || bucket.blockedUntil <= now;
    if (windowExpired && blockExpired) buckets.delete(key);
  }
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** Call before attempting auth. Returns whether the caller is currently locked out. */
export function isRateLimited(key: string): { limited: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  if (buckets.size > 500) sweepExpired(now);

  const bucket = buckets.get(key);
  if (bucket?.blockedUntil && bucket.blockedUntil > now) {
    return { limited: true, retryAfterSeconds: Math.ceil((bucket.blockedUntil - now) / 1000) };
  }
  return { limited: false };
}

/** Call after a failed auth attempt. Locks the key out once it crosses MAX_FAILURES within WINDOW_MS. */
export function recordFailure(key: string) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStartedAt > WINDOW_MS) {
    buckets.set(key, { failures: 1, windowStartedAt: now, blockedUntil: null });
    return;
  }

  bucket.failures += 1;
  if (bucket.failures >= MAX_FAILURES) {
    bucket.blockedUntil = now + BLOCK_MS;
  }
}

/** Call after a successful auth attempt to clear any accumulated failure count. */
export function recordSuccess(key: string) {
  buckets.delete(key);
}
