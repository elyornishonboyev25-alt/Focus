import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { removeSeededPlans } from "../shared/plans.js";
export function openDatabase(filename) {
  if (filename !== ":memory:")
    mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, data TEXT NOT NULL DEFAULT '{}', revision INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, workspace_id TEXT NOT NULL REFERENCES workspaces(id), created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, csrf TEXT NOT NULL, user_id TEXT REFERENCES users(id), workspace_id TEXT NOT NULL REFERENCES workspaces(id), expires_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
    PRAGMA user_version=1;`);
  // Clean existing workspaces once per changed dataset, including accounts
  // which have not opened the new client yet. Revisions invalidate stale writes.
  db.exec("BEGIN IMMEDIATE");
  try {
    const update = db.prepare(
      "UPDATE workspaces SET data=?, revision=revision+1, updated_at=? WHERE id=?",
    );
    for (const row of db.prepare("SELECT id, data FROM workspaces").all()) {
      const values = JSON.parse(row.data);
      const cleaned = removeSeededPlans(values);
      if (cleaned !== values)
        update.run(JSON.stringify(cleaned), Date.now(), row.id);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    db.close();
    throw error;
  }
  return {
    db,
    createWorkspace() {
      const id = randomUUID();
      db.prepare("INSERT INTO workspaces (id, updated_at) VALUES (?, ?)").run(
        id,
        Date.now(),
      );
      return id;
    },
    read(id) {
      const row = db
        .prepare("SELECT data, revision, updated_at FROM workspaces WHERE id=?")
        .get(id);
      return {
        values: JSON.parse(row.data),
        revision: row.revision,
        updatedAt: row.updated_at,
      };
    },
    update(id, revision, changes) {
      const current = this.read(id);
      if (current.revision !== revision) return null;
      const values = { ...current.values, ...changes };
      const result = db
        .prepare(
          "UPDATE workspaces SET data=?, revision=revision+1, updated_at=? WHERE id=? AND revision=?",
        )
        .run(JSON.stringify(values), Date.now(), id, revision);
      return result.changes ? this.read(id) : null;
    },
    reset(id, revision) {
      const result = db
        .prepare(
          "UPDATE workspaces SET data='{}', revision=revision+1, updated_at=? WHERE id=? AND revision=?",
        )
        .run(Date.now(), id, revision);
      return result.changes ? this.read(id) : null;
    },
    close() {
      db.close();
    },
  };
}
