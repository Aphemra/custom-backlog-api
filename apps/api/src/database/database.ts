import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { runtimeConfig } from "../config/runtimeConfig.js";
import { runMigrations } from "./runMigrations.js";

let applicationDatabase: DatabaseSync | undefined;

export function openDatabase(
  databasePath: string = runtimeConfig.databasePath,
): DatabaseSync {
  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), {
      recursive: true,
    });
  }

  const database = new DatabaseSync(databasePath, {
    allowExtension: false,
    defensive: true,
    enableForeignKeyConstraints: true,
    timeout: 5_000,
  });

  database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
  `);

  runMigrations(database);

  return database;
}

export function getDatabase(): DatabaseSync {
  applicationDatabase ??= openDatabase();
  return applicationDatabase;
}

export function closeDatabase(): void {
  applicationDatabase?.close();
  applicationDatabase = undefined;
}
