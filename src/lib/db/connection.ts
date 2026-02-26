import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import path from "path"

const dbPath = path.join(process.cwd(), "sqlite.db")

const sqlite = new Database(dbPath)

// Enable WAL mode for better concurrent read performance
sqlite.pragma("journal_mode = WAL")
// Enable foreign key enforcement
sqlite.pragma("foreign_keys = ON")

export const db = drizzle(sqlite)
export { sqlite }
