import "server-only";
import { createClient, type Client } from "@libsql/client";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
let client: Client | undefined;
let initialized: Promise<Client> | undefined;
export function getDb() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url || (!url.startsWith("file:") && !process.env.TURSO_AUTH_TOKEN)) throw new Error("Database configuration unavailable");
  // file: is exclusively useful for an isolated local verification database.
  return client ??= createClient({ url, authToken: url.startsWith("file:") ? undefined : process.env.TURSO_AUTH_TOKEN, intMode: "bigint" });
}
async function migrate() {
  const db = getDb();
  const schema = await readFile(join(process.cwd(), "migrations/001_expenses.sql"), "utf8");
  const statements = schema.split(";").map((sql) => sql.trim()).filter(Boolean);
  const tx = await db.transaction("write");
  try {
    const { rows } = await tx.execute("PRAGMA table_info(expenses)");
    if (rows.some((column) => column.name === "amount_minor")) {
      // Preserve existing IDs, exact amounts and timestamps. Any incompatible
      // legacy data aborts the transaction instead of truncating or deleting it.
      await tx.execute("ALTER TABLE expenses RENAME TO expenses_legacy");
      await tx.execute("DROP INDEX IF EXISTS expenses_date_created");
      for (const sql of statements) await tx.execute(sql);
      await tx.execute("INSERT INTO expenses (id, concept, amount_centavos, expense_date, category, created_at, updated_at) SELECT id, concept, amount_minor, expense_date, category, created_at, updated_at FROM expenses_legacy");
      await tx.execute("DROP TABLE expenses_legacy");
    } else {
      for (const sql of statements) await tx.execute(sql);
    }
    await tx.commit();
    return db;
  } catch (error) { await tx.rollback(); throw error; }
  finally { tx.close(); }
}
export function ensureSchema() {
  return initialized ??= migrate().catch((error) => { initialized = undefined; throw error; });
}
