import type { DatabaseSync } from "node:sqlite";
import { HttpError } from "../../errors/httpError.js";
import { BacklogActivityRecorder } from "../history/backlogActivityRecorder.js";
import {
  createDatabaseBackup,
  type DatabaseBackupResult,
} from "../backups/createDatabaseBackup.js";

export const deleteEntireBacklogConfirmation = "Delete Entire Backlog";

export interface BacklogDeletionCounts {
  readonly libraryGames: number;
  readonly collections: number;
  readonly savedViews: number;
}

export interface BacklogDeletionResult {
  readonly deletedAt: string;
  readonly deleted: BacklogDeletionCounts;
  readonly backup: DatabaseBackupResult;
}

interface BacklogCountRow {
  readonly library_game_count: number;
  readonly collection_count: number;
  readonly saved_view_count: number;
}

function requireDeletionConfirmation(input: unknown): void {
  if (
    typeof input !== "object" ||
    input === null ||
    Array.isArray(input) ||
    !Object.hasOwn(input, "confirmation") ||
    (input as Record<string, unknown>).confirmation !==
      deleteEntireBacklogConfirmation
  ) {
    throw new HttpError(
      400,
      "invalid_backlog_deletion_confirmation",
      `Type "${deleteEntireBacklogConfirmation}" exactly to delete the backlog.`,
    );
  }
}

function readDeletionCounts(database: DatabaseSync): BacklogDeletionCounts {
  const row = database
    .prepare(
      `
      SELECT
        (
          SELECT COUNT(*)
          FROM library_games
        ) AS library_game_count,
        (
          SELECT COUNT(*)
          FROM collections
        ) AS collection_count,
        (
          SELECT COUNT(*)
          FROM saved_views
          WHERE is_builtin = 0
        ) AS saved_view_count
    `,
    )
    .get() as unknown as BacklogCountRow;

  return {
    libraryGames: row.library_game_count,
    collections: row.collection_count,
    savedViews: row.saved_view_count,
  };
}

export async function deleteEntireBacklog(
  database: DatabaseSync,
  backupDirectory: string,
  input: unknown,
): Promise<BacklogDeletionResult> {
  requireDeletionConfirmation(input);

  const deleted = readDeletionCounts(database);
  const deletedAt = new Date().toISOString();

  const backup = await createDatabaseBackup(database, backupDirectory);

  database.exec("BEGIN IMMEDIATE");

  try {
    database.exec(`
      DELETE FROM saved_views
      WHERE is_builtin = 0;

      DELETE FROM collections;

      DELETE FROM library_games;
    `);

    new BacklogActivityRecorder(database).recordBacklogDeleted(
      deleted,
      deletedAt,
    );

    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");

    throw error;
  }

  return {
    deletedAt,
    deleted,
    backup,
  };
}
