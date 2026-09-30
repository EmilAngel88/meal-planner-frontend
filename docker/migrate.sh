#!/bin/sh
set -eu
node /app/node_modules/prisma/build/index.js migrate deploy --schema=/app/apps/backend/prisma/schema.prisma
case "${SEED_BASE_CATALOG:-true}" in
  true) node /app/apps/backend/dist/prisma/seed.js ;;
  false) ;;
  *) echo 'SEED_BASE_CATALOG must be true or false' >&2; exit 1 ;;
esac
