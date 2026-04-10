FROM oven/bun:1.2.15-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY tsconfig.json ./
COPY drizzle ./drizzle
COPY src ./src

EXPOSE 3000

CMD ["bun", "src/index.ts"]
