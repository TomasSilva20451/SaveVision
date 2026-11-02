import type { NextConfig } from "next";
import { staticDevSecurityHeaders } from "./src/lib/security/security-headers";

/** CSP com nonce vive só no proxy (`src/proxy.ts`); duplicar aqui quebra chunks em navegação cliente. */
const securityHeaders = Object.entries(staticDevSecurityHeaders())
  .filter(([key]) => key !== "Content-Security-Policy")
  .map(([key, value]) => ({
    key,
    value,
  }));

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
  async redirects() {
    return [
      {
        source: "/planeamento",
        destination: "/plano",
        permanent: true,
      },
      {
        source: "/planeamento/plano-poupanca/:id",
        destination: "/plano/plano-poupanca/:id",
        permanent: true,
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
