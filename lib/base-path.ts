// Client-side fetch() calls aren't auto-prefixed with basePath the way
// <Link>/router navigation is, so every client fetch to our own API routes
// needs this. Keep in sync with `basePath` in next.config.ts.
export const BASE_PATH = "/pos-system";

export function apiPath(path: string): string {
  return `${BASE_PATH}${path}`;
}
