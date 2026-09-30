# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NUXT_TELEMETRY_DISABLED=1 PRISMA_SKIP_POSTINSTALL_GENERATE=true
COPY package.json package-lock.json .npmrc ./
COPY scripts/check-node.cjs scripts/check-node.cjs
COPY apps/frontend/package.json apps/frontend/package.json
COPY apps/backend/package.json apps/backend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --workspace=@meal-planner/frontend --include-workspace-root --no-audit --no-fund
COPY tsconfig.base.json ./
COPY apps/frontend apps/frontend
COPY packages/shared packages/shared
RUN npm run build --workspace=@meal-planner/frontend

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 NUXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /app/apps/frontend/.output ./.output
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", ".output/server/index.mjs"]
