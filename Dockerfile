# syntax=docker/dockerfile:1.7
FROM node:26-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# Node 26 slim não inclui corepack (Node 24 sim); alinhar com packageManager.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g corepack@0.36.0 \
  && corepack enable \
  && corepack prepare pnpm@10.22.0 --activate
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml ./
COPY prisma7.config.ts ./
COPY prisma/schema.prisma ./prisma/schema.prisma
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/fintwin_build?schema=public
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/fintwin_build?schema=public
ENV AUTH_SECRET=build-only-auth-secret-not-used-at-runtime
RUN pnpm db:generate
RUN pnpm build

FROM node:26-bookworm-slim AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl clamdscan \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs \
  && mkdir -p /app/storage/documents \
  && chown -R nextjs:nodejs /app

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/scripts/runtime-entrypoint.mjs ./runtime-entrypoint.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/secret-files.mjs ./secret-files.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/environment-policy.mjs ./environment-policy.mjs

USER nextjs
EXPOSE 3000
CMD ["node", "runtime-entrypoint.mjs"]
