import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type {
  PlayStationPlatform,
  PlayStatus,
} from "../library/libraryGameTypes.js";
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
  created_at: string;
  updated_at: string;
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

const COLLECTION_SELECT = `
  SELECT
    c.id,
    c.name,
    c.description,
    c.sort_order,
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
`;

function mapCollection(row: CollectionRow): CollectionSummary {
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

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    gameCount: row.game_count,
    visibleGameCount: row.visible_game_count,
    hiddenGameCount: row.hidden_game_count,
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

  list(): readonly CollectionSummary[] {
    const rows = this.database
      .prepare(
        `${COLLECTION_SELECT}
        GROUP BY c.id
        ORDER BY c.sort_order ASC, c.name ASC
      `,
      )
      .all() as unknown as CollectionRow[];

    return rows.map(mapCollection);
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

    return {
      ...mapCollection(row),
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
