import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import path from "path"

const dbPath = process.env.DB_PATH || path.join(process.cwd(), "sqlite.db")

const sqlite = new Database(dbPath)

// Enable WAL mode for better concurrent read performance
sqlite.pragma("journal_mode = WAL")
// Wait up to 5s if DB is locked by another process (e.g. dev server during build)
sqlite.pragma("busy_timeout = 5000")
// Enable foreign key enforcement
sqlite.pragma("foreign_keys = ON")

export const db = drizzle(sqlite)
export { sqlite }
