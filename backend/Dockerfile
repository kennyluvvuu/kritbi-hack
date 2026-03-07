FROM oven/bun:alpine

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

COPY . .

# Generate and push DB schema on startup
CMD ["sh", "-c", "bunx drizzle-kit push && bun run src/index.ts"]
