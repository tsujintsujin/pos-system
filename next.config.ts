import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/pos-system",
  images: {
    // Product/receipt-logo images are arbitrary admin-entered URLs (no upload/storage
    // set up — see product edit page), so there's no fixed set of hosts to allowlist via
    // remotePatterns. `unoptimized` skips Next's server-side resize/reformat proxy (which
    // would otherwise reject or need risky wildcard-allowlisting those hosts) while still
    // getting next/image's lazy-loading and layout-shift prevention.
    unoptimized: true,
  },
};

export default nextConfig;
