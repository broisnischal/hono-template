FROM oven/bun:1.2.15-alpine AS assets

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY client ./client
COPY tsconfig.json ./
RUN bun run client:build

FROM oven/bun:1.2.15-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY tsconfig.json ./
COPY drizzle ./drizzle
COPY src ./src
COPY --from=assets /app/static ./static

EXPOSE 3000

CMD ["bun", "src/index.ts"]
