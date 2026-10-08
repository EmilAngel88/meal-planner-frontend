# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS base
# Prisma's Debian engine requires OpenSSL. Build and runtime use the same libc/OS.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true
RUN npm install --global npm@11.21.0 --no-audit --no-fund
COPY package.json package-lock.json .npmrc ./
COPY scripts/check-node.cjs scripts/check-node.cjs
COPY scripts/patch-devtools-git.mjs scripts/patch-devtools-git.mjs
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared/package.json packages/shared/package.json

FROM base AS build
RUN npm ci --workspace=@meal-planner/backend --include-workspace-root --no-audit --no-fund
COPY tsconfig.base.json ./
COPY apps/backend apps/backend
RUN node node_modules/prisma/build/index.js generate --schema=apps/backend/prisma/schema.prisma \
    && npm run build --workspace=@meal-planner/backend \
    && node node_modules/typescript/bin/tsc apps/backend/prisma/seed.ts \
       --target ES2022 --module commonjs --esModuleInterop --skipLibCheck \
       --rootDir apps/backend --outDir apps/backend/dist \
    && test -f apps/backend/dist/prisma/seed.js

# An isolated one-shot job: build tools / Prisma CLI are not needed by the API runtime.
FROM build AS migrate
ENV NODE_ENV=production
COPY --chown=node:node docker/migrate.sh /app/docker/migrate.sh
USER node
CMD ["sh", "/app/docker/migrate.sh"]

FROM base AS production-deps
# Prisma/TypeScript are optional tooling peers of the client, not runtime requirements.
RUN npm ci --omit=dev --omit=peer --omit=optional --workspace=@meal-planner/backend --include-workspace-root --no-audit --no-fund \
    && mkdir -p apps/backend/node_modules

FROM node:24-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=5001
COPY --from=production-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=production-deps --chown=node:node /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=build --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=node:node /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=build --chown=node:node /app/apps/backend/dist ./apps/backend/dist
WORKDIR /app/apps/backend
USER node
EXPOSE 5001
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:5001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/src/index.js"]
