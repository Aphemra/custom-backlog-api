import type { Backlog, Bucket, GameEntry, User } from "../../../domain/backlog";
import { BACKLOG_BACKUP_SCHEMA_VERSION, type BacklogBackup } from "../types/backup";
import { normalizeTrophyProgress } from "../../backlog/services/trophyProgressHelpers";

interface CreateBacklogBackupInput {
  user: User;
  backlog: Backlog;
  gameEntries: GameEntry[];
  buckets: Bucket[];
}

export function createBacklogBackup({ user, backlog, gameEntries, buckets }: CreateBacklogBackupInput): BacklogBackup {
  return {
    schemaVersion: BACKLOG_BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    user,
    backlog,
    gameEntries: gameEntries.map((gameEntry) => ({
      ...gameEntry,
      trophyProgress: normalizeTrophyProgress(gameEntry.trophyProgress),
    })),
    buckets,
  };
}
