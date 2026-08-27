import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type {
  CreateLibraryGameInput,
  LibraryGame,
  LibraryGameWithTrophySummary,
  PlayStationPlatform,
  PursuitStatus,
  UpdateLibraryGameInput,
} from "./libraryGameTypes.js";

interface LibraryGameRow {
  id: string;
  title: string;
  sort_title: string;
  platform: PlayStationPlatform;
  pursuit_status: PursuitStatus;
  priority_rank: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  captured_at: string | null;
  bronze_total: number | null;
  silver_total: number | null;
  gold_total: number | null;
  platinum_total: number | null;
  bronze_earned: number | null;
  silver_earned: number | null;
  gold_earned: number | null;
  platinum_earned: number | null;
  progress_percent: number | null;
  is_100_percent: number | null;
  has_platinum: number | null;
}

interface PriorityRankRow {
  priority_rank: number | null;
}

interface GameIdRow {
  id: string;
}

function mapLibraryGame(row: LibraryGameRow): LibraryGameWithTrophySummary {
  const trophySummary =
    row.captured_at === null
      ? null
      : {
          progressPercent: row.progress_percent ?? 0,
          earnedTrophies: {
            bronze: row.bronze_earned ?? 0,
            silver: row.silver_earned ?? 0,
            gold: row.gold_earned ?? 0,
            platinum: row.platinum_earned ?? 0,
          },
          totalTrophies: {
            bronze: row.bronze_total ?? 0,
            silver: row.silver_total ?? 0,
            gold: row.gold_total ?? 0,
            platinum: row.platinum_total ?? 0,
          },
          hasPlatinum: row.has_platinum === 1,
          platinumEarned: (row.platinum_earned ?? 0) > 0,
          is100Percent: row.is_100_percent === 1,
          lastSyncedAt: row.captured_at,
        };

  return {
    id: row.id,
    title: row.title,
    sortTitle: row.sort_title,
    platform: row.platform,
    pursuitStatus: row.pursuit_status,
    priorityRank: row.priority_rank,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
    trophySummary,
  };
}

function createSortTitle(title: string): string {
  return title
    .replace(/^(a|an|the)\s+/i, "")
    .trim()
    .toLocaleLowerCase("en-US");
}

export class LibraryGameRepository {
  constructor(private readonly database: DatabaseSync) {}

  list(includeArchived = false): readonly LibraryGameWithTrophySummary[] {
    const rows = this.database
      .prepare(
        `
        SELECT
          lg.id,
          lg.title,
          lg.sort_title,
          lg.platform,
          lg.pursuit_status,
          lg.priority_rank,
          lg.notes,
          lg.created_at,
          lg.updated_at,
          lg.archived_at,
          ts.captured_at,
          ts.bronze_total,
          ts.silver_total,
          ts.gold_total,
          ts.platinum_total,
          ts.bronze_earned,
          ts.silver_earned,
          ts.gold_earned,
          ts.platinum_earned,
          ts.progress_percent,
          ts.is_100_percent,
          ts.has_platinum
        FROM library_games lg
        LEFT JOIN trophy_snapshots ts
          ON ts.id = (
            SELECT latest.id
            FROM trophy_snapshots latest
            WHERE latest.game_id = lg.id
            ORDER BY latest.captured_at DESC, latest.id DESC
            LIMIT 1
          )
        WHERE lg.archived_at IS NULL OR ? = 1
        ORDER BY
          CASE
            WHEN lg.archived_at IS NULL THEN 0
            ELSE 1
          END,
          lg.priority_rank ASC,
          lg.sort_title ASC
      `,
      )
      .all(includeArchived ? 1 : 0) as unknown as LibraryGameRow[];

    return rows.map(mapLibraryGame);
  }

  findById(gameId: string): LibraryGameWithTrophySummary | null {
    const row = this.database
      .prepare(
        `
        SELECT
          lg.id,
          lg.title,
          lg.sort_title,
          lg.platform,
          lg.pursuit_status,
          lg.priority_rank,
          lg.notes,
          lg.created_at,
          lg.updated_at,
          lg.archived_at,
          ts.captured_at,
          ts.bronze_total,
          ts.silver_total,
          ts.gold_total,
          ts.platinum_total,
          ts.bronze_earned,
          ts.silver_earned,
          ts.gold_earned,
          ts.platinum_earned,
          ts.progress_percent,
          ts.is_100_percent,
          ts.has_platinum
        FROM library_games lg
        LEFT JOIN trophy_snapshots ts
          ON ts.id = (
            SELECT latest.id
            FROM trophy_snapshots latest
            WHERE latest.game_id = lg.id
            ORDER BY latest.captured_at DESC, latest.id DESC
            LIMIT 1
          )
        WHERE lg.id = ?
      `,
      )
      .get(gameId) as unknown as LibraryGameRow | undefined;

    return row === undefined ? null : mapLibraryGame(row);
  }

  create(input: CreateLibraryGameInput): LibraryGameWithTrophySummary {
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    const priorityRank = this.getNextPriorityRank();

    this.database
      .prepare(
        `
        INSERT INTO library_games (
          id,
          title,
          sort_title,
          platform,
          pursuit_status,
          priority_rank,
          notes,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        id,
        input.title,
        createSortTitle(input.title),
        input.platform,
        input.pursuitStatus ?? "unplanned",
        priorityRank,
        input.notes ?? null,
        timestamp,
        timestamp,
      );

    return this.requireById(id);
  }

  update(
    gameId: string,
    input: UpdateLibraryGameInput,
  ): LibraryGameWithTrophySummary | null {
    const currentGame = this.findById(gameId);

    if (currentGame === null) {
      return null;
    }

    const title = input.title ?? currentGame.title;

    const notes = Object.hasOwn(input, "notes")
      ? (input.notes ?? null)
      : currentGame.notes;

    this.database
      .prepare(
        `
        UPDATE library_games
        SET
          title = ?,
          sort_title = ?,
          platform = ?,
          pursuit_status = ?,
          notes = ?,
          updated_at = ?
        WHERE id = ?
      `,
      )
      .run(
        title,
        createSortTitle(title),
        input.platform ?? currentGame.platform,
        input.pursuitStatus ?? currentGame.pursuitStatus,
        notes,
        new Date().toISOString(),
        gameId,
      );

    return this.requireById(gameId);
  }

  archive(gameId: string): LibraryGameWithTrophySummary | null {
    const currentGame = this.findById(gameId);

    if (currentGame === null || currentGame.archivedAt !== null) {
      return currentGame;
    }

    const timestamp = new Date().toISOString();

    this.database
      .prepare(
        `
        UPDATE library_games
        SET
          archived_at = ?,
          updated_at = ?
        WHERE id = ?
      `,
      )
      .run(timestamp, timestamp, gameId);

    return this.requireById(gameId);
  }

  restore(gameId: string): LibraryGameWithTrophySummary | null {
    const currentGame = this.findById(gameId);

    if (currentGame === null || currentGame.archivedAt === null) {
      return currentGame;
    }

    this.database
      .prepare(
        `
        UPDATE library_games
        SET
          priority_rank = ?,
          archived_at = NULL,
          updated_at = ?
        WHERE id = ?
      `,
      )
      .run(this.getNextPriorityRank(), new Date().toISOString(), gameId);

    return this.requireById(gameId);
  }

  deletePermanently(gameId: string): boolean {
    const result = this.database
      .prepare(
        `
        DELETE FROM library_games
        WHERE id = ?
      `,
      )
      .run(gameId);

    return result.changes > 0;
  }

  reorder(orderedGameIds: readonly string[]): boolean {
    const activeGameIds = this.database
      .prepare(
        `
        SELECT id
        FROM library_games
        WHERE archived_at IS NULL
      `,
      )
      .all() as unknown as GameIdRow[];

    const activeGameIdSet = new Set(activeGameIds.map((row) => row.id));

    if (
      activeGameIdSet.size !== orderedGameIds.length ||
      orderedGameIds.some((gameId) => !activeGameIdSet.has(gameId))
    ) {
      return false;
    }

    const updateStatement = this.database.prepare(`
        UPDATE library_games
        SET
          priority_rank = ?,
          updated_at = ?
        WHERE id = ?
      `);

    this.database.exec("BEGIN IMMEDIATE");

    try {
      const timestamp = new Date().toISOString();

      orderedGameIds.forEach((gameId, index) => {
        updateStatement.run((index + 1) * 1_000, timestamp, gameId);
      });

      this.database.exec("COMMIT");
      return true;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  private getNextPriorityRank(): number {
    const row = this.database
      .prepare(
        `
        SELECT
          MAX(priority_rank) AS priority_rank
        FROM library_games
        WHERE archived_at IS NULL
      `,
      )
      .get() as unknown as PriorityRankRow;

    return (row.priority_rank ?? 0) + 1_000;
  }

  private requireById(gameId: string): LibraryGameWithTrophySummary {
    const game = this.findById(gameId);

    if (game === null) {
      throw new Error(
        `Library game ${gameId} disappeared during a database operation.`,
      );
    }

    return game;
  }
}
