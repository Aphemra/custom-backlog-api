import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { Migration } from "./migration.js";
import { migrations } from "./migrations/index.js";

interface AppliedMigrationRow {
  version: number;
  name: string;
  checksum: string;
}

function calculateChecksum(migration: Migration): string {
  const normalizedSql = migration.sql.replaceAll("\r\n", "\n").trim();

  return createHash("sha256").update(normalizedSql).digest("hex");
}

function validateMigrationRegistry(
  registeredMigrations: readonly Migration[],
): void {
  let previousVersion = 0;

  for (const migration of registeredMigrations) {
    if (
      !Number.isInteger(migration.version) ||
      migration.version <= previousVersion
    ) {
      throw new Error(
        "Database migrations must have unique, ascending positive versions.",
      );
    }

    previousVersion = migration.version;
  }
}

export function runMigrations(
  database: DatabaseSync,
  registeredMigrations: readonly Migration[] = migrations,
): void {
  validateMigrationRegistry(registeredMigrations);

  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL
    ) STRICT;
  `);

  const appliedMigrations = database
    .prepare(
      `
      SELECT version, name, checksum
      FROM schema_migrations
      ORDER BY version ASC
    `,
    )
    .all() as unknown as AppliedMigrationRow[];

  const appliedByVersion = new Map(
    appliedMigrations.map((migration) => [migration.version, migration]),
  );

  for (const migration of registeredMigrations) {
    const checksum = calculateChecksum(migration);
    const appliedMigration = appliedByVersion.get(migration.version);

    if (appliedMigration !== undefined) {
      if (
        appliedMigration.name !== migration.name ||
        appliedMigration.checksum !== checksum
      ) {
        throw new Error(
          `Migration ${migration.version} has changed after being applied. Add a new migration instead.`,
        );
      }

      continue;
    }

    database.exec("BEGIN IMMEDIATE");

    try {
      database.exec(migration.sql);

      database
        .prepare(
          `
          INSERT INTO schema_migrations (
            version,
            name,
            checksum,
            applied_at
          ) VALUES (?, ?, ?, ?)
        `,
        )
        .run(
          migration.version,
          migration.name,
          checksum,
          new Date().toISOString(),
        );

      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
}
