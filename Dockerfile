# syntax = docker/dockerfile:1

# The garden: one Node process that serves the page, renders README.md at
# /readme/, and keeps its SQLite file on the /data volume. Node runs the
# TypeScript as it is, so there is no build stage, only an install.
# It serves HTTP on 0.0.0.0:$PORT, which fly.toml sets.

FROM docker.io/library/node:24.21.0-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm@11.9.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

FROM docker.io/library/node:24.21.0-alpine
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/data
COPY --from=deps /app/node_modules ./node_modules
COPY package.json README.md ./
COPY server ./server
COPY public ./public
CMD ["node", "server/main.ts"]
