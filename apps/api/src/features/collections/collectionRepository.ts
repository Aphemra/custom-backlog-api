import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type {
  PlayStationPlatform,
  PlayStatus,
} from "../library/libraryGameTypes.js";
import { calculateLibraryTrophyAvailability } from "../library/libraryTrophyAvailability.js";
import { calculateTrophyPointSummary } from "../playstation/playStationTrophyPoints.js";
import type { PlayStationTrophyCounts } from "../playstation/playStationTypes.js";
import type {
  CollectionDetail,
  CollectionGame,
  CollectionSummary,
  CreateCollectionInput,
  UpdateCollectionInput,
} from "./collectionTypes.js";

interface CollectionRow {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_pinned: number;
  game_count: number;
  visible_game_count: number;
  hidden_game_count: number;
  trophy_game_count: number;
  completed_game_count: number;
  bronze_earned: number;
  silver_earned: number;
  gold_earned: number;
  platinum_earned: number;
  bronze_total: number;
  silver_total: number;
  gold_total: number;
  platinum_total: number;
  unobtainable_bronze: number;
  unobtainable_silver: number;
  unobtainable_gold: number;
  unobtainable_platinum: number;
  time_game_count: number;
  time_hastily_game_count: number;
  time_normally_game_count: number;
  time_completely_game_count: number;
  time_hastily_seconds: number;
  time_normally_seconds: number;
  time_completely_seconds: number;
  time_submission_count: number;
  created_at: string;
  updated_at: string;
}

interface CollectionGameProgressRow {
  collection_id: string;
  progress_percent: number | null;
  bronze_earned: number | null;
  silver_earned: number | null;
  gold_earned: number | null;
  platinum_earned: number | null;
  bronze_total: number | null;
  silver_total: number | null;
  gold_total: number | null;
  platinum_total: number | null;
  unobtainable_bronze: number;
  unobtainable_silver: number;
  unobtainable_gold: number;
  unobtainable_platinum: number;
}

interface CollectionProgressAccumulator {
  totalProgress: number;
  gameCount: number;
}

interface CollectionGameRow {
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
  collection_sort_order: number;
  added_at: string;
}

interface SortOrderRow {
  sort_order: number | null;
}

interface IdRow {
  id: string;
}

interface CollectionMembershipRow {
  collection_id: string;
}

const COLLECTION_SELECT = `
  SELECT
    c.id,
    c.name,
    c.description,
    c.sort_order,
    c.is_pinned,
    COUNT(cg.game_id) AS game_count,
    COALESCE(SUM(
      CASE
        WHEN lg.id IS NOT NULL AND lg.archived_at IS NULL THEN 1
        ELSE 0
      END
    ), 0) AS visible_game_count,
    COALESCE(SUM(
      CASE
        WHEN lg.id IS NOT NULL AND lg.archived_at IS NOT NULL THEN 1
        ELSE 0
      END
    ), 0) AS hidden_game_count,
    COALESCE(SUM(
      CASE WHEN ts.id IS NOT NULL THEN 1 ELSE 0 END
    ), 0) AS trophy_game_count,
    COALESCE(SUM(
      CASE
        WHEN ts.is_100_percent = 1 THEN 1
        ELSE 0
      END
    ), 0) AS completed_game_count,
    COALESCE(SUM(ts.bronze_earned), 0) AS bronze_earned,
    COALESCE(SUM(ts.silver_earned), 0) AS silver_earned,
    COALESCE(SUM(ts.gold_earned), 0) AS gold_earned,
    COALESCE(SUM(ts.platinum_earned), 0) AS platinum_earned,
    COALESCE(SUM(ts.bronze_total), 0) AS bronze_total,
    COALESCE(SUM(ts.silver_total), 0) AS silver_total,
    COALESCE(SUM(ts.gold_total), 0) AS gold_total,
    COALESCE(SUM(ts.platinum_total), 0) AS platinum_total,
    COALESCE(SUM(trophy_availability.bronze), 0)
      AS unobtainable_bronze,
    COALESCE(SUM(trophy_availability.silver), 0)
      AS unobtainable_silver,
    COALESCE(SUM(trophy_availability.gold), 0)
      AS unobtainable_gold,
    COALESCE(SUM(trophy_availability.platinum), 0)
      AS unobtainable_platinum,
    COALESCE(SUM(
      CASE
        WHEN
          igdb_time.time_hastily_seconds IS NOT NULL OR
          igdb_time.time_normally_seconds IS NOT NULL OR
          igdb_time.time_completely_seconds IS NOT NULL
        THEN 1
        ELSE 0
      END
    ), 0) AS time_game_count,
    COALESCE(SUM(
      CASE
        WHEN igdb_time.time_hastily_seconds IS NOT NULL THEN 1
        ELSE 0
      END
    ), 0) AS time_hastily_game_count,
    COALESCE(SUM(
      CASE
        WHEN igdb_time.time_normally_seconds IS NOT NULL THEN 1
        ELSE 0
      END
    ), 0) AS time_normally_game_count,
    COALESCE(SUM(
      CASE
        WHEN igdb_time.time_completely_seconds IS NOT NULL THEN 1
        ELSE 0
      END
    ), 0) AS time_completely_game_count,
    COALESCE(SUM(igdb_time.time_hastily_seconds), 0)
      AS time_hastily_seconds,
    COALESCE(SUM(igdb_time.time_normally_seconds), 0)
      AS time_normally_seconds,
    COALESCE(SUM(igdb_time.time_completely_seconds), 0)
      AS time_completely_seconds,
    COALESCE(SUM(igdb_time.time_submission_count), 0)
      AS time_submission_count,
    c.created_at,
    c.updated_at
  FROM collections c
  LEFT JOIN collection_games cg ON cg.collection_id = c.id
  LEFT JOIN library_games lg ON lg.id = cg.game_id
  LEFT JOIN trophy_snapshots ts ON ts.id = (
    SELECT latest.id
    FROM trophy_snapshots latest
    WHERE latest.game_id = lg.id
    ORDER BY latest.captured_at DESC, latest.id DESC
    LIMIT 1
  )
  LEFT JOIN (
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
  ) trophy_availability
    ON trophy_availability.game_id = lg.id
  LEFT JOIN game_metadata_links gml ON gml.game_id = lg.id
  LEFT JOIN external_game_metadata metadata ON
    metadata.id = gml.metadata_id AND
    metadata.provider = 'igdb'
  LEFT JOIN igdb_game_details igdb_time ON
    igdb_time.metadata_id = metadata.id
`;

const COLLECTION_GAME_PROGRESS_SELECT = `
  SELECT
    cg.collection_id,
    ts.progress_percent,
    ts.bronze_earned,
    ts.silver_earned,
    ts.gold_earned,
    ts.platinum_earned,
    ts.bronze_total,
    ts.silver_total,
    ts.gold_total,
    ts.platinum_total,
    COALESCE(trophy_availability.bronze, 0)
      AS unobtainable_bronze,
    COALESCE(trophy_availability.silver, 0)
      AS unobtainable_silver,
    COALESCE(trophy_availability.gold, 0)
      AS unobtainable_gold,
    COALESCE(trophy_availability.platinum, 0)
      AS unobtainable_platinum
  FROM collection_games cg
  LEFT JOIN trophy_snapshots ts ON ts.id = (
    SELECT latest.id
    FROM trophy_snapshots latest
    WHERE latest.game_id = cg.game_id
    ORDER BY latest.captured_at DESC, latest.id DESC
    LIMIT 1
  )
  LEFT JOIN (
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
  ) trophy_availability
    ON trophy_availability.game_id = cg.game_id
`;

function countTrophies(counts: PlayStationTrophyCounts): number {
  return counts.bronze + counts.silver + counts.gold + counts.platinum;
}

function calculateAverageTrophyProgress(
  rows: readonly CollectionGameProgressRow[],
): ReadonlyMap<string, number> {
  const accumulators = new Map<string, CollectionProgressAccumulator>();

  for (const row of rows) {
    const earnedTrophies: PlayStationTrophyCounts = {
      bronze: row.bronze_earned ?? 0,
      silver: row.silver_earned ?? 0,
      gold: row.gold_earned ?? 0,
      platinum: row.platinum_earned ?? 0,
    };

    const totalTrophies: PlayStationTrophyCounts = {
      bronze: row.bronze_total ?? 0,
      silver: row.silver_total ?? 0,
      gold: row.gold_total ?? 0,
      platinum: row.platinum_total ?? 0,
    };

    const unobtainableTrophies: PlayStationTrophyCounts = {
      bronze: row.unobtainable_bronze,
      silver: row.unobtainable_silver,
      gold: row.unobtainable_gold,
      platinum: row.unobtainable_platinum,
    };

    let displayedProgress = 0;

    if (row.progress_percent !== null) {
      const availability = calculateLibraryTrophyAvailability(
        earnedTrophies,
        totalTrophies,
        unobtainableTrophies,
      );

      displayedProgress =
        countTrophies(availability.unobtainableTrophies) > 0
          ? availability.attainableProgressPercent
          : row.progress_percent;
    }

    const accumulator = accumulators.get(row.collection_id) ?? {
      totalProgress: 0,
      gameCount: 0,
    };

    accumulator.totalProgress += displayedProgress;
    accumulator.gameCount += 1;

    accumulators.set(row.collection_id, accumulator);
  }

  const averages = new Map<string, number>();

  for (const [collectionId, accumulator] of accumulators) {
    averages.set(
      collectionId,
      accumulator.gameCount === 0
        ? 0
        : Math.floor(accumulator.totalProgress / accumulator.gameCount),
    );
  }

  return averages;
}

function mapCollection(
  row: CollectionRow,
  averageTrophyProgressPercent: number,
): CollectionSummary {
  const earnedTrophies: PlayStationTrophyCounts = {
    bronze: row.bronze_earned,
    silver: row.silver_earned,
    gold: row.gold_earned,
    platinum: row.platinum_earned,
  };
  const totalTrophies: PlayStationTrophyCounts = {
    bronze: row.bronze_total,
    silver: row.silver_total,
    gold: row.gold_total,
    platinum: row.platinum_total,
  };
  const pointSummary = calculateTrophyPointSummary(
    earnedTrophies,
    totalTrophies,
  );
  const unobtainableTrophies: PlayStationTrophyCounts = {
    bronze: row.unobtainable_bronze,
    silver: row.unobtainable_silver,
    gold: row.unobtainable_gold,
    platinum: row.unobtainable_platinum,
  };
  const availability = calculateLibraryTrophyAvailability(
    earnedTrophies,
    totalTrophies,
    unobtainableTrophies,
  );

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    isPinned: row.is_pinned === 1,
    gameCount: row.game_count,
    visibleGameCount: row.visible_game_count,
    hiddenGameCount: row.hidden_game_count,
    averageTrophyProgressPercent,
    trophySummary:
      row.trophy_game_count === 0
        ? null
        : {
            gameCountWithTrophies: row.trophy_game_count,
            completedGameCount: row.completed_game_count,
            earnedTrophies,
            totalTrophies,
            points: {
              earned: pointSummary.earnedPoints,
              total: pointSummary.totalPoints,
              remaining: pointSummary.remainingPoints,
            },
            availability,
          },
    timeEstimateSummary:
      row.time_game_count === 0
        ? null
        : {
            gameCountWithEstimates: row.time_game_count,
            hastily: {
              gameCount: row.time_hastily_game_count,
              totalSeconds: row.time_hastily_seconds,
            },
            normally: {
              gameCount: row.time_normally_game_count,
              totalSeconds: row.time_normally_seconds,
            },
            completely: {
              gameCount: row.time_completely_game_count,
              totalSeconds: row.time_completely_seconds,
            },
            submissionCount: row.time_submission_count,
          },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCollectionGame(row: CollectionGameRow): CollectionGame {
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
    collectionSortOrder: row.collection_sort_order,
    addedAt: row.added_at,
  };
}

export class CollectionRepository {
  constructor(private readonly database: DatabaseSync) {}

  private findAverageTrophyProgressByCollectionId(): ReadonlyMap<
    string,
    number
  > {
    const rows = this.database
      .prepare(COLLECTION_GAME_PROGRESS_SELECT)
      .all() as unknown as CollectionGameProgressRow[];

    return calculateAverageTrophyProgress(rows);
  }

  list(): readonly CollectionSummary[] {
    const rows = this.database
      .prepare(
        `${COLLECTION_SELECT}
        GROUP BY c.id
        ORDER BY c.sort_order ASC, c.name ASC
      `,
      )
      .all() as unknown as CollectionRow[];

    const averageProgressByCollectionId =
      this.findAverageTrophyProgressByCollectionId();

    return rows.map((row) =>
      mapCollection(row, averageProgressByCollectionId.get(row.id) ?? 0),
    );
  }

  findById(collectionId: string): CollectionDetail | null {
    const row = this.database
      .prepare(
        `${COLLECTION_SELECT}
        WHERE c.id = ?
        GROUP BY c.id
      `,
      )
      .get(collectionId) as unknown as CollectionRow | undefined;

    if (row === undefined) {
      return null;
    }

    const averageProgressByCollectionId =
      this.findAverageTrophyProgressByCollectionId();

    return {
      ...mapCollection(row, averageProgressByCollectionId.get(row.id) ?? 0),
      games: this.listGames(collectionId),
    };
  }

  create(input: CreateCollectionInput): CollectionDetail {
    const id = randomUUID();
    const timestamp = new Date().toISOString();

    this.database
      .prepare(
        `
        INSERT INTO collections (
          id,
          name,
          description,
          sort_order,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        id,
        input.name,
        input.description ?? null,
        this.getNextSortOrder(),
        timestamp,
        timestamp,
      );

    return this.requireById(id);
  }

  update(
    collectionId: string,
    input: UpdateCollectionInput,
  ): CollectionDetail | null {
    const currentCollection = this.findById(collectionId);

    if (currentCollection === null) {
      return null;
    }

    const description = Object.hasOwn(input, "description")
      ? (input.description ?? null)
      : currentCollection.description;

    this.database
      .prepare(
        `
        UPDATE collections
        SET
          name = ?,
          description = ?,
          updated_at = ?
        WHERE id = ?
      `,
      )
      .run(
        input.name ?? currentCollection.name,
        description,
        new Date().toISOString(),
        collectionId,
      );

    return this.requireById(collectionId);
  }

  reorder(orderedCollectionIds: readonly string[]): boolean {
    const rows = this.database
      .prepare("SELECT id FROM collections")
      .all() as unknown as IdRow[];

    const collectionIds = new Set(rows.map((row) => row.id));

    if (
      collectionIds.size !== orderedCollectionIds.length ||
      orderedCollectionIds.some(
        (collectionId) => !collectionIds.has(collectionId),
      )
    ) {
      return false;
    }

    const updateStatement = this.database.prepare(`
      UPDATE collections
      SET
        sort_order = ?,
        updated_at = ?
      WHERE id = ?
    `);

    this.database.exec("BEGIN IMMEDIATE");

    try {
      const timestamp = new Date().toISOString();

      orderedCollectionIds.forEach((collectionId, index) => {
        updateStatement.run((index + 1) * 1_000, timestamp, collectionId);
      });

      this.database.exec("COMMIT");

      return true;
    } catch (error) {
      this.database.exec("ROLLBACK");

      throw error;
    }
  }

  setPinned(collectionId: string | null): CollectionDetail | null {
    if (collectionId !== null && this.findById(collectionId) === null) {
      return null;
    }

    this.database.exec("BEGIN IMMEDIATE");

    try {
      this.database
        .prepare(
          `
          UPDATE collections
          SET is_pinned = 0
          WHERE is_pinned = 1
        `,
        )
        .run();

      if (collectionId !== null) {
        this.database
          .prepare(
            `
            UPDATE collections
            SET is_pinned = 1
            WHERE id = ?
          `,
          )
          .run(collectionId);
      }

      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");

      throw error;
    }

    return collectionId === null ? null : this.requireById(collectionId);
  }

  replaceGames(
    collectionId: string,
    orderedGameIds: readonly string[],
  ): boolean {
    const rows = this.database
      .prepare("SELECT id FROM library_games")
      .all() as unknown as IdRow[];

    const libraryGameIds = new Set(rows.map((row) => row.id));

    if (orderedGameIds.some((gameId) => !libraryGameIds.has(gameId))) {
      return false;
    }

    const deleteStatement = this.database.prepare(`
      DELETE FROM collection_games
      WHERE collection_id = ?
    `);

    const insertStatement = this.database.prepare(`
      INSERT INTO collection_games (
        collection_id,
        game_id,
        sort_order,
        added_at
      ) VALUES (?, ?, ?, ?)
    `);

    this.database.exec("BEGIN IMMEDIATE");

    try {
      deleteStatement.run(collectionId);

      const timestamp = new Date().toISOString();

      orderedGameIds.forEach((gameId, index) => {
        insertStatement.run(
          collectionId,
          gameId,
          (index + 1) * 1_000,
          timestamp,
        );
      });

      this.database
        .prepare(
          `
          UPDATE collections
          SET updated_at = ?
          WHERE id = ?
        `,
        )
        .run(timestamp, collectionId);

      this.database.exec("COMMIT");

      return true;
    } catch (error) {
      this.database.exec("ROLLBACK");

      throw error;
    }
  }

  replaceGameMemberships(
    gameId: string,
    collectionIds: readonly string[],
  ): boolean {
    const gameExists =
      this.database
        .prepare("SELECT id FROM library_games WHERE id = ?")
        .get(gameId) !== undefined;

    if (!gameExists) {
      return false;
    }

    const collectionRows = this.database
      .prepare("SELECT id FROM collections")
      .all() as unknown as IdRow[];

    const existingCollectionIds = new Set(collectionRows.map((row) => row.id));

    if (
      new Set(collectionIds).size !== collectionIds.length ||
      collectionIds.some(
        (collectionId) => !existingCollectionIds.has(collectionId),
      )
    ) {
      return false;
    }

    const currentRows = this.database
      .prepare(
        `
        SELECT collection_id
        FROM collection_games
        WHERE game_id = ?
      `,
      )
      .all(gameId) as unknown as CollectionMembershipRow[];

    const currentCollectionIds = new Set(
      currentRows.map((row) => row.collection_id),
    );

    const desiredCollectionIds = new Set(collectionIds);
    const changedCollectionIds = new Set<string>();

    const deleteMembership = this.database.prepare(`
      DELETE FROM collection_games
      WHERE collection_id = ? AND game_id = ?
    `);

    const nextSortOrder = this.database.prepare(`
      SELECT MAX(sort_order) AS sort_order
      FROM collection_games
      WHERE collection_id = ?
    `);

    const insertMembership = this.database.prepare(`
      INSERT INTO collection_games (
        collection_id,
        game_id,
        sort_order,
        added_at
      ) VALUES (?, ?, ?, ?)
    `);

    const updateCollection = this.database.prepare(`
      UPDATE collections
      SET updated_at = ?
      WHERE id = ?
    `);

    this.database.exec("BEGIN IMMEDIATE");

    try {
      const timestamp = new Date().toISOString();

      for (const collectionId of currentCollectionIds) {
        if (!desiredCollectionIds.has(collectionId)) {
          deleteMembership.run(collectionId, gameId);
          changedCollectionIds.add(collectionId);
        }
      }

      for (const collectionId of collectionIds) {
        if (currentCollectionIds.has(collectionId)) {
          continue;
        }

        const currentMaximum = nextSortOrder.get(collectionId) as unknown as
          | SortOrderRow
          | undefined;

        insertMembership.run(
          collectionId,
          gameId,
          (currentMaximum?.sort_order ?? 0) + 1_000,
          timestamp,
        );

        changedCollectionIds.add(collectionId);
      }

      for (const collectionId of changedCollectionIds) {
        updateCollection.run(timestamp, collectionId);
      }

      this.database.exec("COMMIT");

      return true;
    } catch (error) {
      this.database.exec("ROLLBACK");

      throw error;
    }
  }

  deletePermanently(collectionId: string): boolean {
    const result = this.database
      .prepare("DELETE FROM collections WHERE id = ?")
      .run(collectionId);

    return result.changes > 0;
  }

  private listGames(collectionId: string): readonly CollectionGame[] {
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
          cg.sort_order AS collection_sort_order,
          cg.added_at
        FROM collection_games cg
        INNER JOIN library_games lg ON lg.id = cg.game_id
        WHERE cg.collection_id = ?
        ORDER BY cg.sort_order ASC, lg.sort_title ASC
      `,
      )
      .all(collectionId) as unknown as CollectionGameRow[];

    return rows.map(mapCollectionGame);
  }

  private getNextSortOrder(): number {
    const row = this.database
      .prepare("SELECT MAX(sort_order) AS sort_order FROM collections")
      .get() as unknown as SortOrderRow;

    return (row.sort_order ?? 0) + 1_000;
  }

  private requireById(collectionId: string): CollectionDetail {
    const collection = this.findById(collectionId);

    if (collection === null) {
      throw new Error(
        `Collection ${collectionId} disappeared during a database operation.`,
      );
    }

    return collection;
  }
}
