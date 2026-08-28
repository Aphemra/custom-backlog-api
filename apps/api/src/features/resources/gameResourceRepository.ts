import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { HttpError } from "../../errors/httpError.js";
import { resolveGameResourceTarget } from "./gameResourceValidation.js";
import type {
  CreateGameResourceInput,
  GameResource,
  GameResourceProvider,
  GameResourceType,
  UpdateGameResourceInput,
} from "./gameResourceTypes.js";

interface GameResourceRow {
  id: string;
  game_id: string;
  resource_type: GameResourceType;
  provider: GameResourceProvider;
  url: string;
  label: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface IdRow {
  id: string;
}

interface SortOrderRow {
  sort_order: number | null;
}

function mapGameResource(row: GameResourceRow): GameResource {
  return {
    id: row.id,
    gameId: row.game_id,
    resourceType: row.resource_type,
    provider: row.provider,
    url: row.url,
    label: row.label,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class GameResourceRepository {
  constructor(private readonly database: DatabaseSync) {}

  listByGame(gameId: string): readonly GameResource[] {
    const rows = this.database
      .prepare(
        `
          SELECT
            id,
            game_id,
            resource_type,
            provider,
            url,
            label,
            sort_order,
            created_at,
            updated_at
          FROM game_resources
          WHERE game_id = ?
          ORDER BY
            sort_order ASC,
            id ASC
        `,
      )
      .all(gameId) as unknown as GameResourceRow[];

    return rows.map(mapGameResource);
  }

  findById(gameId: string, resourceId: string): GameResource | null {
    const row = this.database
      .prepare(
        `
          SELECT
            id,
            game_id,
            resource_type,
            provider,
            url,
            label,
            sort_order,
            created_at,
            updated_at
          FROM game_resources
          WHERE game_id = ? AND id = ?
        `,
      )
      .get(gameId, resourceId) as unknown as GameResourceRow | undefined;

    return row === undefined ? null : mapGameResource(row);
  }

  create(gameId: string, input: CreateGameResourceInput): GameResource | null {
    if (!this.gameExists(gameId)) {
      return null;
    }

    const target = resolveGameResourceTarget(input.resourceType, input.url);

    this.assertNoConflicts(gameId, target.resourceType, target.url, null);

    const resourceId = randomUUID();
    const timestamp = new Date().toISOString();

    this.database
      .prepare(
        `
          INSERT INTO game_resources (
            id,
            game_id,
            resource_type,
            provider,
            url,
            label,
            sort_order,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        resourceId,
        gameId,
        target.resourceType,
        target.provider,
        target.url,
        input.label ?? null,
        this.getNextSortOrder(gameId),
        timestamp,
        timestamp,
      );

    return this.requireById(gameId, resourceId);
  }

  update(
    gameId: string,
    resourceId: string,
    input: UpdateGameResourceInput,
  ): GameResource | null {
    const currentResource = this.findById(gameId, resourceId);

    if (currentResource === null) {
      return null;
    }

    const target = resolveGameResourceTarget(
      input.resourceType ?? currentResource.resourceType,
      input.url ?? currentResource.url,
    );

    this.assertNoConflicts(gameId, target.resourceType, target.url, resourceId);

    const label = Object.hasOwn(input, "label")
      ? (input.label ?? null)
      : currentResource.label;

    this.database
      .prepare(
        `
          UPDATE game_resources
          SET
            resource_type = ?,
            provider = ?,
            url = ?,
            label = ?,
            updated_at = ?
          WHERE game_id = ? AND id = ?
        `,
      )
      .run(
        target.resourceType,
        target.provider,
        target.url,
        label,
        new Date().toISOString(),
        gameId,
        resourceId,
      );

    return this.requireById(gameId, resourceId);
  }

  reorder(gameId: string, orderedResourceIds: readonly string[]): boolean {
    if (!this.gameExists(gameId)) {
      return false;
    }

    const rows = this.database
      .prepare(
        `
          SELECT id
          FROM game_resources
          WHERE game_id = ?
        `,
      )
      .all(gameId) as unknown as IdRow[];

    const existingIds = new Set(rows.map((row) => row.id));

    if (
      existingIds.size !== orderedResourceIds.length ||
      orderedResourceIds.some((resourceId) => !existingIds.has(resourceId))
    ) {
      return false;
    }

    const updateResource = this.database.prepare(`
      UPDATE game_resources
      SET
        sort_order = ?,
        updated_at = ?
      WHERE game_id = ? AND id = ?
    `);

    this.database.exec("BEGIN IMMEDIATE");

    try {
      const timestamp = new Date().toISOString();

      orderedResourceIds.forEach((resourceId, index) => {
        updateResource.run((index + 1) * 1_000, timestamp, gameId, resourceId);
      });

      this.database.exec("COMMIT");

      return true;
    } catch (error) {
      this.database.exec("ROLLBACK");

      throw error;
    }
  }

  deletePermanently(gameId: string, resourceId: string): boolean {
    const result = this.database
      .prepare(
        `
          DELETE FROM game_resources
          WHERE game_id = ? AND id = ?
        `,
      )
      .run(gameId, resourceId);

    return result.changes > 0;
  }

  private gameExists(gameId: string): boolean {
    const row = this.database
      .prepare(
        `
          SELECT id
          FROM library_games
          WHERE id = ?
        `,
      )
      .get(gameId) as unknown as IdRow | undefined;

    return row !== undefined;
  }

  private getNextSortOrder(gameId: string): number {
    const row = this.database
      .prepare(
        `
          SELECT MAX(sort_order) AS sort_order
          FROM game_resources
          WHERE game_id = ?
        `,
      )
      .get(gameId) as unknown as SortOrderRow;

    return (row.sort_order ?? 0) + 1_000;
  }

  private assertNoConflicts(
    gameId: string,
    resourceType: GameResourceType,
    url: string,
    excludedResourceId: string | null,
  ): void {
    const excludedId = excludedResourceId ?? "";

    const duplicateUrl = this.database
      .prepare(
        `
          SELECT id
          FROM game_resources
          WHERE
            game_id = ?
            AND url = ?
            AND id <> ?
        `,
      )
      .get(gameId, url, excludedId) as unknown as IdRow | undefined;

    if (duplicateUrl !== undefined) {
      throw new HttpError(
        409,
        "resource_url_already_exists",
        "This URL is already attached to the selected game.",
      );
    }

    if (resourceType !== "trophy_page") {
      return;
    }

    const existingTrophyPage = this.database
      .prepare(
        `
          SELECT id
          FROM game_resources
          WHERE
            game_id = ?
            AND resource_type = 'trophy_page'
            AND id <> ?
        `,
      )
      .get(gameId, excludedId) as unknown as IdRow | undefined;

    if (existingTrophyPage !== undefined) {
      throw new HttpError(
        409,
        "trophy_page_already_exists",
        "This game already has an exact PSNProfiles trophy-page URL.",
      );
    }
  }

  private requireById(gameId: string, resourceId: string): GameResource {
    const resource = this.findById(gameId, resourceId);

    if (resource === null) {
      throw new Error(
        `Game resource ${resourceId} disappeared during a database operation.`,
      );
    }

    return resource;
  }
}
