import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type {
  PlayStationPlatform,
  PursuitStatus,
} from "../library/libraryGameTypes.js";
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
  active_game_count: number;
  archived_game_count: number;
  created_at: string;
  updated_at: string;
}

interface CollectionGameRow {
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
    ), 0) AS active_game_count,
    COALESCE(SUM(
      CASE
        WHEN lg.id IS NOT NULL AND lg.archived_at IS NOT NULL THEN 1
        ELSE 0
      END
    ), 0) AS archived_game_count,
    c.created_at,
    c.updated_at
  FROM collections c
  LEFT JOIN collection_games cg ON cg.collection_id = c.id
  LEFT JOIN library_games lg ON lg.id = cg.game_id
`;

function mapCollection(row: CollectionRow): CollectionSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    gameCount: row.game_count,
    activeGameCount: row.active_game_count,
    archivedGameCount: row.archived_game_count,
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
    pursuitStatus: row.pursuit_status,
    priorityRank: row.priority_rank,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
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
          lg.pursuit_status,
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
