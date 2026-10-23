import type { NextConfig } from "next";
import {
  contentSecurityPolicy,
  PERMISSIONS_POLICY,
  strictTransportSecurity,
} from "./src/lib/security/security-headers";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
  { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
  ...(strictTransportSecurity()
    ? [{ key: "Strict-Transport-Security", value: strictTransportSecurity()! }]
    : []),
];

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  output: "standalone",
  serverExternalPackages: [
    "pg",
    "@prisma/adapter-pg",
    "argon2",
    "@opentelemetry/sdk-node",
    "@opentelemetry/exporter-trace-otlp-http",
    "@opentelemetry/exporter-metrics-otlp-http",
  ],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
