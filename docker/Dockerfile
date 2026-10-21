# syntax=docker/dockerfile:1.7
FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./

# --- Stage 1: build web ---
FROM base AS web
COPY web/package.json ./web/
RUN pnpm install --filter @sym-albums/web --frozen-lockfile
COPY web ./web
RUN pnpm --filter @sym-albums/web build

# --- Stage 2: build server ---
FROM base AS server
COPY server/package.json ./server/
RUN pnpm install --filter @sym-albums/server --frozen-lockfile
COPY server ./server
RUN pnpm --filter @sym-albums/server build

# --- Stage 3: runtime ---
FROM node:24-alpine AS runtime
WORKDIR /app/server
ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV WEB_DIST=/app/web/dist
ENV PORT=3000
ENV HOST=0.0.0.0

# Prod deps are installed here by npm (musl prebuilds for sharp / better-sqlite3);
# the cache is cleaned in the same layer so it never lands in the image.
COPY server/package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --from=server /app/server/dist ./dist
COPY --from=web    /app/web/dist    /app/web/dist

# App files stay root-owned and read-only; only /data needs to be writable.
# The node image already has a `node` user at UID 1000.
RUN mkdir -p /data /photos /albums && chown node:node /data
USER node

EXPOSE 3000
VOLUME ["/data", "/photos", "/albums"]

CMD ["node", "dist/index.js"]
