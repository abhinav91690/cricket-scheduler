// Simple migration runner using better-sqlite3 directly.
// Reads drizzle migration files and applies them in order,
// tracking which have been applied in a __drizzle_migrations table.

const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const dbPath = process.env.DB_PATH || path.join(process.cwd(), "sqlite.db");
const migrationsDir = path.join(__dirname, "drizzle");
const journalPath = path.join(migrationsDir, "meta", "_journal.json");

console.log("DB path:", dbPath);
console.log("Migrations dir:", migrationsDir);

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Create migrations tracking table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Read journal
const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));

// Get already applied migrations
const applied = new Set(
  db.prepare("SELECT tag FROM __drizzle_migrations").all().map((r) => r.tag)
);

let appliedCount = 0;

for (const entry of journal.entries) {
  if (applied.has(entry.tag)) {
    console.log("  skip:", entry.tag, "(already applied)");
    continue;
  }

  const sqlFile = path.join(migrationsDir, entry.tag + ".sql");
  const sql = fs.readFileSync(sqlFile, "utf-8");

  // Split on statement breakpoints and add IF NOT EXISTS for CREATE TABLE
  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => s.replace(/CREATE TABLE `/g, "CREATE TABLE IF NOT EXISTS `"));

  const migrate = db.transaction(() => {
    for (const stmt of statements) {
      db.exec(stmt);
    }
    db.prepare("INSERT INTO __drizzle_migrations (tag) VALUES (?)").run(entry.tag);
  });

  migrate();
  console.log("  applied:", entry.tag);
  appliedCount++;
}

if (appliedCount === 0) {
  console.log("Database is up to date.");
} else {
  console.log("Applied " + appliedCount + " migration(s).");
}

db.close();
