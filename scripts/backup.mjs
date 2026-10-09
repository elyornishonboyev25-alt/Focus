import { DatabaseSync, backup } from "node:sqlite";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const source = resolve(process.env.DATABASE_PATH || "data/daily-system.sqlite");
await mkdir("backups", { recursive: true });
const target = resolve(
  "backups",
  "daily-system-" + new Date().toISOString().replace(/[:.]/g, "-") + ".sqlite",
);
const db = new DatabaseSync(source, { readOnly: true });
try {
  await backup(db, target);
  console.log("Backup saved:", target);
} finally {
  db.close();
}
