import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Content-Security-Policy. Loosened in dev for hot reload.
// Analytics hosts are allowed only when their IDs are configured (scripts still
// load only after the visitor accepts cookies).
const ga = process.env.NEXT_PUBLIC_GA_ID ? " https://www.googletagmanager.com" : "";
const gaConnect = process.env.NEXT_PUBLIC_GA_ID ? " https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com" : "";
const meta = process.env.NEXT_PUBLIC_META_PIXEL_ID ? " https://connect.facebook.net" : "";
const metaImg = process.env.NEXT_PUBLIC_META_PIXEL_ID ? " https://www.facebook.com" : "";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}${ga}${meta}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${gaConnect}${metaImg}`,
  "font-src 'self'",
  `connect-src 'self'${gaConnect}${metaImg}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=(self)" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  experimental: {
    // Bag-replacement claims upload up to 5 photos (shrunk in the browser first).
    serverActions: { bodySizeLimit: "12mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/ops/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
    ];
  },
};

export default nextConfig;
