# Stage 1: Install dependencies
FROM node:22-slim AS deps
WORKDIR /app

# Install build tools for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build the application
FROM node:22-slim AS builder
WORKDIR /app

# Install build tools for better-sqlite3 (needed during next build)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: Production runtime
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV DB_PATH=/data/sqlite.db
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    mkdir -p /data && chown nextjs:nodejs /data

# Copy standalone server
COPY --from=builder /app/.next/standalone ./
# Copy static assets
COPY --from=builder /app/.next/static ./.next/static
# Copy drizzle SQL migration files for runtime migration
COPY --from=builder /app/drizzle ./drizzle
# Copy migration runner
COPY --from=builder /app/migrate.js ./migrate.js

USER nextjs

EXPOSE 3000

CMD ["sh", "-c", "node migrate.js && node server.js"]
