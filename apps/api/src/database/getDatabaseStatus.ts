import type { DatabaseSync } from "node:sqlite";
import { migrations } from "./migrations/index.js";

interface SchemaVersionRow {
  version: number | null;
}

export interface DatabaseStatus {
  readonly ok: true;
  readonly schemaVersion: number;
  readonly availableMigrationCount: number;
}

export function getDatabaseStatus(database: DatabaseSync): DatabaseStatus {
  database.prepare("SELECT 1").get();

  const row = database
    .prepare(
      `
      SELECT MAX(version) AS version
      FROM schema_migrations
    `,
    )
    .get() as unknown as SchemaVersionRow;

  return {
    ok: true,
    schemaVersion: row.version ?? 0,
    availableMigrationCount: migrations.length,
  };
}
