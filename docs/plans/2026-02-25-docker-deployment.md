# Docker Deployment Implementation Plan

**Goal:** Deploy the Cricket Tournament Scheduler as a Docker image with a mounted volume for persistent SQLite storage.

**Architecture:** Multi-stage Docker build (Node.js build stage → slim runtime). Next.js standalone output mode for minimal image size. SQLite DB path configurable via `DB_PATH` env var, defaulting to `/data/sqlite.db` in Docker (volume mount) and `./sqlite.db` locally. `drizzle-kit push` runs at container startup via entrypoint script.

**Tech Stack:** Docker, Next.js standalone output, better-sqlite3 (native module), drizzle-kit migrations

---

### Task 1: Make DB path configurable via environment variable

**Files:**
- Modify: `src/lib/db/connection.ts`
- Modify: `drizzle.config.ts`

**Step 1: Write the failing test**

No test — these are config/infra files that need a running DB. Manual verification.

**Step 2: Update `src/lib/db/connection.ts`**

```typescript
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import path from "path"

const dbPath = process.env.DB_PATH || path.join(process.cwd(), "sqlite.db")

const sqlite = new Database(dbPath)

// Enable WAL mode for better concurrent read performance
sqlite.pragma("journal_mode = WAL")
// Enable foreign key enforcement
sqlite.pragma("foreign_keys = ON")

export const db = drizzle(sqlite)
export { sqlite }
```

**Step 3: Update `drizzle.config.ts`**

```typescript
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DB_PATH || "./sqlite.db",
  },
})
```

**Step 4: Verify locally**

Run: `npm run build`
Expected: Build succeeds, app still works with default path.

**Step 5: Commit**

```bash
git add src/lib/db/connection.ts drizzle.config.ts
git commit -m "feat: make DB path configurable via DB_PATH env var"
```

---

### Task 2: Enable Next.js standalone output

**Files:**
- Modify: `next.config.ts`

**Step 1: Update `next.config.ts`**

```typescript
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
}

export default nextConfig
```

**Step 2: Verify build produces standalone output**

Run: `npm run build`
Expected: `.next/standalone/` directory is created with a `server.js` entry point.

**Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat: enable Next.js standalone output for Docker"
```

---

### Task 3: Create `.dockerignore`

**Files:**
- Create: `.dockerignore`

**Step 1: Create `.dockerignore`**

```
node_modules
.next
.git
sqlite.db
sqlite.db-shm
sqlite.db-wal
*.md
docs
.vscode
.kiro
```

**Step 2: Commit**

```bash
git add .dockerignore
git commit -m "chore: add .dockerignore"
```

---

### Task 4: Create multi-stage Dockerfile

**Files:**
- Create: `Dockerfile`

**Step 1: Create `Dockerfile`**

```dockerfile
# Stage 1: Install dependencies
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build the application
FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Production runtime
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV DB_PATH=/data/sqlite.db

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    mkdir -p /data && chown nextjs:nodejs /data

# Copy standalone server
COPY --from=builder /app/.next/standalone ./
# Copy static assets
COPY --from=builder /app/.next/static ./.next/static
# Copy public folder if it exists
COPY --from=builder /app/public ./public 2>/dev/null || true
# Copy drizzle migrations
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/src/lib/db/schema.ts ./src/lib/db/schema.ts
# Copy entrypoint
COPY --from=builder /app/entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

# Install drizzle-kit for migrations at runtime
RUN npm install -g drizzle-kit

USER nextjs

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
```

**Step 2: Commit**

```bash
git add Dockerfile
git commit -m "feat: add multi-stage Dockerfile"
```

---

### Task 5: Create entrypoint script

**Files:**
- Create: `entrypoint.sh`

**Step 1: Create `entrypoint.sh`**

```bash
#!/bin/sh
set -e

echo "Running database migrations..."
DB_PATH="${DB_PATH:-/data/sqlite.db}" npx drizzle-kit push --config=drizzle.config.ts

echo "Starting server..."
exec node server.js
```

**Step 2: Commit**

```bash
git add entrypoint.sh
git commit -m "feat: add entrypoint script with auto-migration"
```

---

### Task 6: Create docker-compose.yml

**Files:**
- Create: `docker-compose.yml`

**Step 1: Create `docker-compose.yml`**

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - cricket-data:/data
    environment:
      - DB_PATH=/data/sqlite.db

volumes:
  cricket-data:
```

**Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add docker-compose.yml with persistent volume"
```

---

### Task 7: Build and test Docker image

**Step 1: Build the image**

Run: `docker build -t cricket-scheduler .`
Expected: Build completes without errors.

**Step 2: Run with docker-compose**

Run: `docker compose up -d`
Expected: Container starts, migrations run, app accessible at http://localhost:3000

**Step 3: Verify persistence**

1. Create a tournament via the UI
2. Run: `docker compose down`
3. Run: `docker compose up -d`
4. Verify tournament still exists

**Step 4: Commit**

```bash
git commit --allow-empty -m "chore: verified Docker deployment works"
```

---

### Task 8: Add Docker section to README

**Files:**
- Modify: `README.md`

**Step 1: Add Docker deployment section after "Getting Started"**

```markdown
## Docker Deployment

Build and run with Docker Compose:

```bash
docker compose up -d
```

The app will be available at http://localhost:3000. Data is persisted in a Docker volume (`cricket-data`).

To rebuild after code changes:

```bash
docker compose up -d --build
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_PATH` | `/data/sqlite.db` | Path to SQLite database file |

### Manual Docker Commands

```bash
# Build
docker build -t cricket-scheduler .

# Run with volume mount
docker run -p 3000:3000 -v cricket-data:/data cricket-scheduler
```
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add Docker deployment section to README"
```
