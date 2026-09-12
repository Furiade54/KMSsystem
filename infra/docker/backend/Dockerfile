FROM node:20-slim AS builder

WORKDIR /app

RUN npm install --no-audit --no-fund --loglevel=error --location=global typescript@5 tsc-alias

COPY packages/shared-types/ ./packages/shared-types/
COPY backend/ ./backend/

RUN npm install --no-audit --no-fund --loglevel=error --prefix /app/packages/shared-types \
    && npm install --no-audit --no-fund --loglevel=error --prefix /app/backend

RUN set -e; cd /app/backend \
    && npx tsc -p tsconfig.json \
    && npx tsc-alias -p tsconfig.json

FROM node:20-slim AS runtime

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends tini \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    NODE_OPTIONS="--tls-min-v1.0 --tls-max-v1.2"

COPY packages/shared-types/ ./packages/shared-types/

RUN npm install --omit=dev --no-audit --no-fund --loglevel=error --prefix /app/packages/shared-types

COPY --from=builder /app/backend/package*.json ./backend/
RUN npm install --omit=dev --no-audit --no-fund --loglevel=error --prefix /app/backend

COPY --from=builder /app/backend/dist ./backend/dist

RUN mkdir -p /app/backend/storage \
    && chown -R node:node /app/backend/storage

VOLUME ["/app/backend/storage"]

WORKDIR /app/backend

USER node

EXPOSE 51478

ENTRYPOINT ["/usr/bin/tini", "--"]

CMD ["node", "dist/backend/src/server.js"]
