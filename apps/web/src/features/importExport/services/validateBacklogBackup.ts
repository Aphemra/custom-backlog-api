import { BACKLOG_BACKUP_SCHEMA_VERSION, type BacklogBackup } from "../types/backup";
import { normalizeTrophyProgress } from "../../backlog/services/trophyProgressHelpers";

export function validateBacklogBackup(data: unknown): BacklogBackup {
  if (!isRecord(data)) {
    throw new Error("Backup file must contain a JSON object.");
  }

  if (data.schemaVersion !== BACKLOG_BACKUP_SCHEMA_VERSION) {
    throw new Error(`Unsupported backup schema version. Expected version ${BACKLOG_BACKUP_SCHEMA_VERSION}.`);
  }

  if (typeof data.exportedAt !== "string") {
    throw new Error("Backup file is missing exportedAt.");
  }

  if (!isRecord(data.user)) {
    throw new Error("Backup file is missing user data.");
  }

  if (!isRecord(data.backlog)) {
    throw new Error("Backup file is missing backlog data.");
  }

  if (!Array.isArray(data.gameEntries)) {
    throw new Error("Backup file is missing game entries.");
  }

  if (!Array.isArray(data.buckets)) {
    throw new Error("Backup file is missing buckets.");
  }

  if (typeof data.user.id !== "string") {
    throw new Error("Backup user is missing an id.");
  }

  if (typeof data.backlog.id !== "string") {
    throw new Error("Backup backlog is missing an id.");
  }

  const backup = data as unknown as BacklogBackup;

  return {
    ...backup,
    gameEntries: backup.gameEntries.map((gameEntry) => ({
      ...gameEntry,
      trophyProgress: normalizeTrophyProgress(gameEntry.trophyProgress ?? {}),
    })),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
