import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { backup, type DatabaseSync } from "node:sqlite";

export interface DatabaseBackupResult {
  readonly fileName: string;
  readonly createdAt: string;
}

function createBackupFileName(createdAt: string): string {
  const safeTimestamp = createdAt.replaceAll(":", "-").replaceAll(".", "-");

  return `trophy-backlog-${safeTimestamp}.sqlite`;
}

export async function createDatabaseBackup(
  database: DatabaseSync,
  backupDirectory: string,
): Promise<DatabaseBackupResult> {
  const createdAt = new Date().toISOString();
  const fileName = createBackupFileName(createdAt);

  await mkdir(backupDirectory, {
    recursive: true,
  });

  await backup(database, resolve(backupDirectory, fileName));

  return {
    fileName,
    createdAt,
  };
}
