import type { Backlog, Bucket, GameEntry, User } from "../../../domain/backlog";

export const BACKLOG_BACKUP_SCHEMA_VERSION = 1;

export interface BacklogBackup {
  schemaVersion: typeof BACKLOG_BACKUP_SCHEMA_VERSION;
  exportedAt: string;
  user: User;
  backlog: Backlog;
  gameEntries: GameEntry[];
  buckets: Bucket[];
}
