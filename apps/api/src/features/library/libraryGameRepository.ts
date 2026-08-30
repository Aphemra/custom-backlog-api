import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { calculateTrophyPointSummary } from "../playstation/playStationTrophyPoints.js";
import { calculateLibraryTrophyAvailability } from "./libraryTrophyAvailability.js";
import {
  PlayStationTrophyIntelligenceService,
  type PlayStationGameTrophyIntelligence,
} from "../playstation/playStationTrophyIntelligence.js";
import {
  createCompatiblePursuitStatus,
  type CreateLibraryGameInput,
  type LibraryGame,
  type LibraryGameWithArtwork,
  type LibraryTrophyCounts,
  type PlayStationPlatform,
  type PlayStatus,
  type UpdateLibraryGameInput,
} from "./libraryGameTypes.js";

interface LibraryGameRow {
  id: string;
  title: string;
  sort_title: string;
  platform: PlayStationPlatform;
  play_status: PlayStatus;
  is_unobtainable: number;
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
  artwork_image_id: string | null;
  artwork_role: "cover" | "icon" | "background" | null;
}

interface UnobtainableTrophyCountRow {
  game_id: string;
  bronze: number;
  silver: number;
  gold: number;
  platinum: number;
}

const noUnobtainableTrophies: LibraryTrophyCounts = {
  bronze: 0,
  silver: 0,
  gold: 0,
  platinum: 0,
};

interface PriorityRankRow {
  priority_rank: number | null;
}

interface GameIdRow {
  id: string;
}

function mapLibraryGame(
  row: LibraryGameRow,
  intelligence: PlayStationGameTrophyIntelligence | null,
  unobtainableTrophies: LibraryTrophyCounts,
): LibraryGameWithArtwork {
  const earnedTrophies = {
    bronze: row.bronze_earned ?? 0,
    silver: row.silver_earned ?? 0,
    gold: row.gold_earned ?? 0,
    platinum: row.platinum_earned ?? 0,
  };
  const totalTrophies = {
    bronze: row.bronze_total ?? 0,
    silver: row.silver_total ?? 0,
    gold: row.gold_total ?? 0,
    platinum: row.platinum_total ?? 0,
  };
  const pointSummary = calculateTrophyPointSummary(
    earnedTrophies,
    totalTrophies,
  );
  const availability = calculateLibraryTrophyAvailability(
    earnedTrophies,
    totalTrophies,
    unobtainableTrophies,
  );
  const trophySummary =
    row.captured_at === null
      ? null
      : {
          progressPercent: row.progress_percent ?? 0,
          earnedTrophies,
          totalTrophies,
          points: {
            earned: pointSummary.earnedPoints,
            total: pointSummary.totalPoints,
            remaining: pointSummary.remainingPoints,
          },
          availability,
          timing: intelligence?.timing ?? null,
          hasPlatinum: row.has_platinum === 1,
          platinumEarned: (row.platinum_earned ?? 0) > 0,
          is100Percent: row.is_100_percent === 1,
          lastSyncedAt: row.captured_at,
        };

  const artwork =
    row.artwork_image_id === null ||
    row.artwork_image_id === undefined ||
    row.artwork_role === null ||
    row.artwork_role === undefined
      ? null
      : {
          imageId: row.artwork_image_id,
          url: `/api/images/${row.artwork_image_id}`,
          role: row.artwork_role,
        };

  return {
    id: row.id,
    title: row.title,
    sortTitle: row.sort_title,
    platform: row.platform,
    playStatus: row.play_status,
    isUnobtainable: row.is_unobtainable === 1,
    priorityRank: row.priority_rank,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hiddenAt: row.archived_at,
    trophySummary,
    artwork,
  };
}

function createSortTitle(title: string): string {
  return title
    .replace(/^(a|an|the)\s+/i, "")
    .trim()
    .toLocaleLowerCase("en-US");
}

export class LibraryGameRepository {
  private readonly trophyIntelligence: PlayStationTrophyIntelligenceService;

  constructor(private readonly database: DatabaseSync) {
    this.trophyIntelligence = new PlayStationTrophyIntelligenceService(
      database,
    );
  }

  private findUnobtainableTrophyCounts(): ReadonlyMap<
    string,
    LibraryTrophyCounts
  > {
    const rows = this.database
      .prepare(
        `
        SELECT
          trophies.game_id,
          SUM(
            CASE WHEN trophies.trophy_type = 'bronze' THEN 1 ELSE 0 END
          ) AS bronze,
          SUM(
            CASE WHEN trophies.trophy_type = 'silver' THEN 1 ELSE 0 END
          ) AS silver,
          SUM(
            CASE WHEN trophies.trophy_type = 'gold' THEN 1 ELSE 0 END
          ) AS gold,
          SUM(
            CASE WHEN trophies.trophy_type = 'platinum' THEN 1 ELSE 0 END
          ) AS platinum
        FROM playstation_trophies trophies
        INNER JOIN playstation_trophy_availability_overrides availability
          ON availability.game_id = trophies.game_id
          AND availability.trophy_id = trophies.trophy_id
        WHERE trophies.is_earned = 0
        GROUP BY trophies.game_id
      `,
      )
      .all() as unknown as UnobtainableTrophyCountRow[];

    return new Map(
      rows.map((row) => [
        row.game_id,
        {
          bronze: row.bronze,
          silver: row.silver,
          gold: row.gold,
          platinum: row.platinum,
        },
      ]),
    );
  }

  list(includeHidden = false): readonly LibraryGameWithArtwork[] {
    const rows = this.database
      .prepare(
        `
        SELECT
          lg.id,
          lg.title,
          lg.sort_title,
          lg.platform,
          lg.play_status,
          lg.is_unobtainable,
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
          ts.has_platinum,
          COALESCE(lgi.image_id, ps_image.id) AS artwork_image_id,
          CASE
            WHEN lgi.image_id IS NOT NULL THEN lgi.role
            WHEN ps_image.id IS NOT NULL THEN 'icon'
            ELSE NULL
          END AS artwork_role
        FROM library_games lg
        LEFT JOIN library_game_images lgi
          ON lgi.rowid = (
            SELECT preferred_image.rowid
            FROM library_game_images preferred_image
            WHERE preferred_image.game_id = lg.id
            ORDER BY
              CASE preferred_image.role
                WHEN 'cover' THEN 0
                WHEN 'icon' THEN 1
                ELSE 2
              END,
              preferred_image.sort_order ASC,
              preferred_image.image_id ASC
            LIMIT 1
          )
        LEFT JOIN playstation_game_links psl
          ON psl.game_id = lg.id
        LEFT JOIN cached_images ps_image
          ON ps_image.id = (
            SELECT latest_ps_image.id
            FROM cached_images latest_ps_image
            WHERE
              latest_ps_image.provider = 'playstation'
              AND latest_ps_image.source_key LIKE (
                'trophy-title:'
                || psl.np_service_name
                || ':'
                || psl.np_communication_id
                || ':%'
              )
            ORDER BY
              latest_ps_image.updated_at DESC,
              latest_ps_image.id ASC
            LIMIT 1
          )
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
      .all(includeHidden ? 1 : 0) as unknown as LibraryGameRow[];

    const intelligenceByGameId = this.trophyIntelligence.findAll();
    const unobtainableTrophiesByGameId = this.findUnobtainableTrophyCounts();

    return rows.map((row) =>
      mapLibraryGame(
        row,
        intelligenceByGameId.get(row.id) ?? null,
        unobtainableTrophiesByGameId.get(row.id) ?? noUnobtainableTrophies,
      ),
    );
  }

  findById(gameId: string): LibraryGameWithArtwork | null {
    const row = this.database
      .prepare(
        `
        SELECT
          lg.id,
          lg.title,
          lg.sort_title,
          lg.platform,
          lg.play_status,
          lg.is_unobtainable,
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
          ts.has_platinum,
          COALESCE(lgi.image_id, ps_image.id) AS artwork_image_id,
          CASE
            WHEN lgi.image_id IS NOT NULL THEN lgi.role
            WHEN ps_image.id IS NOT NULL THEN 'icon'
            ELSE NULL
          END AS artwork_role
        FROM library_games lg
        LEFT JOIN library_game_images lgi
          ON lgi.rowid = (
            SELECT preferred_image.rowid
            FROM library_game_images preferred_image
            WHERE preferred_image.game_id = lg.id
            ORDER BY
              CASE preferred_image.role
                WHEN 'cover' THEN 0
                WHEN 'icon' THEN 1
                ELSE 2
              END,
              preferred_image.sort_order ASC,
              preferred_image.image_id ASC
            LIMIT 1
          )
        LEFT JOIN playstation_game_links psl
          ON psl.game_id = lg.id
        LEFT JOIN cached_images ps_image
          ON ps_image.id = (
            SELECT latest_ps_image.id
            FROM cached_images latest_ps_image
            WHERE
              latest_ps_image.provider = 'playstation'
              AND latest_ps_image.source_key LIKE (
                'trophy-title:'
                || psl.np_service_name
                || ':'
                || psl.np_communication_id
                || ':%'
              )
            ORDER BY
              latest_ps_image.updated_at DESC,
              latest_ps_image.id ASC
            LIMIT 1
          )
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

    if (row === undefined) {
      return null;
    }

    const unobtainableTrophies =
      this.findUnobtainableTrophyCounts().get(gameId) ?? noUnobtainableTrophies;

    return mapLibraryGame(
      row,
      this.trophyIntelligence.findByGameId(gameId),
      unobtainableTrophies,
    );
  }

  create(input: CreateLibraryGameInput): LibraryGameWithArtwork {
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    const priorityRank = this.getNextPriorityRank();

    const playStatus = input.playStatus ?? "not_started";

    const pursuitStatus = createCompatiblePursuitStatus(playStatus);

    this.database
      .prepare(
        `
        INSERT INTO library_games (
          id,
          title,
          sort_title,
          platform,
          pursuit_status,
          play_status,
          is_unobtainable,
          priority_rank,
          notes,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        id,
        input.title,
        createSortTitle(input.title),
        input.platform,
        pursuitStatus,
        playStatus,
        input.isUnobtainable === true ? 1 : 0,
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
  ): LibraryGameWithArtwork | null {
    const currentGame = this.findById(gameId);

    if (currentGame === null) {
      return null;
    }

    const title = input.title ?? currentGame.title;

    const notes = Object.hasOwn(input, "notes")
      ? (input.notes ?? null)
      : currentGame.notes;

    const playStatus = input.playStatus ?? currentGame.playStatus;

    const pursuitStatus = createCompatiblePursuitStatus(playStatus);

    const isUnobtainable = input.isUnobtainable ?? currentGame.isUnobtainable;

    this.database
      .prepare(
        `
        UPDATE library_games
        SET
          title = ?,
          sort_title = ?,
          platform = ?,
          pursuit_status = ?,
          play_status = ?,
          is_unobtainable = ?,
          notes = ?,
          updated_at = ?
        WHERE id = ?
      `,
      )
      .run(
        title,
        createSortTitle(title),
        input.platform ?? currentGame.platform,
        pursuitStatus,
        playStatus,
        isUnobtainable ? 1 : 0,
        notes,
        new Date().toISOString(),
        gameId,
      );

    return this.requireById(gameId);
  }

  hide(gameId: string): LibraryGameWithArtwork | null {
    const currentGame = this.findById(gameId);

    if (currentGame === null || currentGame.hiddenAt !== null) {
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

  unhide(gameId: string): LibraryGameWithArtwork | null {
    const currentGame = this.findById(gameId);

    if (currentGame === null || currentGame.hiddenAt === null) {
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

  private requireById(gameId: string): LibraryGameWithArtwork {
    const game = this.findById(gameId);

    if (game === null) {
      throw new Error(
        `Library game ${gameId} disappeared during a database operation.`,
      );
    }

    return game;
  }
}
