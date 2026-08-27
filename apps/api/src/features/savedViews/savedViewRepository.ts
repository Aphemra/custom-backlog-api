import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type {
  LibraryGameWithTrophySummary,
  PlayStationPlatform,
  PursuitStatus,
} from "../library/libraryGameTypes.js";
import type {
  CreateSavedViewInput,
  SavedView,
  SavedViewFilters,
  SavedViewSort,
  UpdateSavedViewInput,
} from "./savedViewTypes.js";
import {
  parseSavedViewFilters,
  parseSavedViewSort,
} from "./savedViewValidation.js";

interface SavedViewRow {
  id: string;
  builtin_key: string | null;
  name: string;
  filters_json: string;
  sort_json: string;
  sort_order: number;
  is_builtin: number;
  created_at: string;
  updated_at: string;
}

interface SortOrderRow {
  sort_order: number | null;
}

interface IdRow {
  id: string;
}

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
  alert_created_at: string | null;
}

const SAVED_VIEW_SELECT = `
  SELECT
    id,
    builtin_key,
    name,
    filters_json,
    sort_json,
    sort_order,
    is_builtin,
    created_at,
    updated_at
  FROM saved_views
`;

function normalizeTimestamp(value: string): string {
  const date = new Date(
    value.includes("T") ? value : `${value.replace(" ", "T")}Z`,
  );

  if (Number.isNaN(date.valueOf())) {
    throw new Error(`Database contains an invalid timestamp: ${value}`);
  }

  return date.toISOString();
}

function mapSavedView(row: SavedViewRow): SavedView {
  const filters = parseSavedViewFilters(
    JSON.parse(row.filters_json) as unknown,
  );

  const sort = parseSavedViewSort(JSON.parse(row.sort_json) as unknown);

  return {
    id: row.id,
    builtinKey: row.builtin_key,
    name: row.name,
    filters,
    sort,
    sortOrder: row.sort_order,
    isBuiltin: row.is_builtin === 1,
    isAvailable: true,
    unavailableReason: null,
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  };
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

export class SavedViewRepository {
  constructor(private readonly database: DatabaseSync) {}

  list(): readonly SavedView[] {
    const rows = this.database
      .prepare(
        `${SAVED_VIEW_SELECT}
        ORDER BY sort_order ASC, name ASC`,
      )
      .all() as unknown as SavedViewRow[];

    return rows.map(mapSavedView);
  }

  findById(viewId: string): SavedView | null {
    const row = this.database
      .prepare(
        `${SAVED_VIEW_SELECT}
        WHERE id = ?`,
      )
      .get(viewId) as unknown as SavedViewRow | undefined;

    return row === undefined ? null : mapSavedView(row);
  }

  create(input: CreateSavedViewInput): SavedView {
    const id = randomUUID();
    const timestamp = new Date().toISOString();

    this.database
      .prepare(
        `
        INSERT INTO saved_views (
          id,
          builtin_key,
          name,
          filters_json,
          sort_json,
          sort_order,
          is_builtin,
          created_at,
          updated_at
        ) VALUES (?, NULL, ?, ?, ?, ?, 0, ?, ?)
      `,
      )
      .run(
        id,
        input.name,
        JSON.stringify(input.filters),
        JSON.stringify(input.sort),
        this.getNextSortOrder(),
        timestamp,
        timestamp,
      );

    return this.requireById(id);
  }

  update(viewId: string, input: UpdateSavedViewInput): SavedView | null {
    const current = this.findById(viewId);

    if (current === null) {
      return null;
    }

    this.database
      .prepare(
        `
        UPDATE saved_views
        SET
          name = ?,
          filters_json = ?,
          sort_json = ?,
          updated_at = ?
        WHERE id = ?
      `,
      )
      .run(
        input.name ?? current.name,
        JSON.stringify(input.filters ?? current.filters),
        JSON.stringify(input.sort ?? current.sort),
        new Date().toISOString(),
        viewId,
      );

    return this.requireById(viewId);
  }

  delete(viewId: string): boolean {
    const result = this.database
      .prepare("DELETE FROM saved_views WHERE id = ?")
      .run(viewId);

    return result.changes > 0;
  }

  reorder(orderedViewIds: readonly string[]): boolean {
    const rows = this.database
      .prepare("SELECT id FROM saved_views")
      .all() as unknown as IdRow[];

    const viewIds = new Set(rows.map((row) => row.id));

    if (
      viewIds.size !== orderedViewIds.length ||
      orderedViewIds.some((viewId) => !viewIds.has(viewId))
    ) {
      return false;
    }

    const update = this.database.prepare(`
      UPDATE saved_views
      SET
        sort_order = ?,
        updated_at = ?
      WHERE id = ?
    `);

    this.database.exec("BEGIN IMMEDIATE");

    try {
      const timestamp = new Date().toISOString();

      orderedViewIds.forEach((viewId, index) => {
        update.run((index + 1) * 10, timestamp, viewId);
      });

      this.database.exec("COMMIT");

      return true;
    } catch (error) {
      this.database.exec("ROLLBACK");

      throw error;
    }
  }

  collectionIdsExist(filters: SavedViewFilters): boolean {
    if (filters.collectionIds === undefined) {
      return true;
    }

    const rows = this.database
      .prepare("SELECT id FROM collections")
      .all() as unknown as IdRow[];

    const collectionIds = new Set(rows.map((row) => row.id));

    return filters.collectionIds.every((collectionId) =>
      collectionIds.has(collectionId),
    );
  }

  listUsingCollection(collectionId: string): readonly SavedView[] {
    return this.list().filter((view) =>
      view.filters.collectionIds?.includes(collectionId),
    );
  }

  listGames(
    view: SavedView,
    liveSearch?: string,
  ): readonly LibraryGameWithTrophySummary[] {
    const filters = view.filters;
    const conditions: string[] = [];
    const parameters: Array<string | number> = [];

    const archiveMode = filters.archiveMode ?? "active";

    if (archiveMode === "active") {
      conditions.push("lg.archived_at IS NULL");
    }

    if (archiveMode === "archived") {
      conditions.push("lg.archived_at IS NOT NULL");
    }

    if (filters.platforms !== undefined) {
      conditions.push(
        `lg.platform IN (${filters.platforms.map(() => "?").join(", ")})`,
      );

      parameters.push(...filters.platforms);
    }

    if (filters.pursuitStatuses !== undefined) {
      conditions.push(
        `lg.pursuit_status IN (${filters.pursuitStatuses
          .map(() => "?")
          .join(", ")})`,
      );

      parameters.push(...filters.pursuitStatuses);
    }

    if (filters.collectionIds !== undefined) {
      conditions.push(`
        EXISTS (
          SELECT 1
          FROM collection_games cg
          WHERE cg.game_id = lg.id
            AND cg.collection_id IN (${filters.collectionIds
              .map(() => "?")
              .join(", ")})
        )
      `);

      parameters.push(...filters.collectionIds);
    }

    if (filters.platinumEarned !== undefined) {
      conditions.push("ts.id IS NOT NULL");

      conditions.push(
        filters.platinumEarned
          ? "ts.platinum_earned > 0"
          : "ts.platinum_earned = 0",
      );
    }

    if (filters.is100Percent !== undefined) {
      conditions.push("ts.id IS NOT NULL");

      conditions.push(
        filters.is100Percent
          ? "ts.is_100_percent = 1"
          : "ts.is_100_percent = 0",
      );
    }

    if (filters.needsSync !== undefined) {
      conditions.push(
        filters.needsSync
          ? "psl.game_id IS NOT NULL AND ts.id IS NULL"
          : "(psl.game_id IS NULL OR ts.id IS NOT NULL)",
      );
    }

    if (filters.alertKinds !== undefined || filters.alertStatus !== undefined) {
      const alertConditions = ["ta.game_id = lg.id"];

      if (filters.alertKinds !== undefined) {
        alertConditions.push(
          `ta.kind IN (${filters.alertKinds.map(() => "?").join(", ")})`,
        );

        parameters.push(...filters.alertKinds);
      }

      if (filters.alertStatus !== undefined) {
        alertConditions.push("ta.status = ?");
        parameters.push(filters.alertStatus);
      }

      conditions.push(`
        EXISTS (
          SELECT 1
          FROM trophy_alerts ta
          WHERE ${alertConditions.join(" AND ")}
        )
      `);
    }

    for (const search of [filters.search, liveSearch]) {
      const normalizedSearch = search?.trim();

      if (normalizedSearch !== undefined && normalizedSearch.length > 0) {
        conditions.push(`
          (
            instr(
              lower(lg.title),
              lower(?)
            ) > 0
            OR
            instr(
              lower(COALESCE(lg.notes, '')),
              lower(?)
            ) > 0
          )
        `);

        parameters.push(normalizedSearch, normalizedSearch);
      }
    }

    const sortColumns: Readonly<Record<string, string>> = {
      priorityRank: "lg.priority_rank",
      title: "lg.sort_title",
      platform: "lg.platform",
      pursuitStatus: "lg.pursuit_status",
      createdAt: "lg.created_at",
      updatedAt: "lg.updated_at",
      progressPercent: "ts.progress_percent",
      lastSyncedAt: "ts.captured_at",
      alertCreatedAt: "alert_created_at",
    };

    const sortColumn = sortColumns[view.sort.field];

    if (sortColumn === undefined) {
      throw new Error(`Saved view ${view.id} uses an unavailable sort field.`);
    }

    const direction = view.sort.direction === "desc" ? "DESC" : "ASC";

    const where =
      conditions.length === 0 ? "" : `WHERE ${conditions.join(" AND ")}`;

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
          ts.has_platinum,
          (
            SELECT MAX(latest_alert.created_at)
            FROM trophy_alerts latest_alert
            WHERE latest_alert.game_id = lg.id
          ) AS alert_created_at
        FROM library_games lg
        LEFT JOIN trophy_snapshots ts
          ON ts.id = (
            SELECT latest_snapshot.id
            FROM trophy_snapshots latest_snapshot
            WHERE latest_snapshot.game_id = lg.id
            ORDER BY
              latest_snapshot.captured_at DESC,
              latest_snapshot.id DESC
            LIMIT 1
          )
        LEFT JOIN playstation_game_links psl
          ON psl.game_id = lg.id
        ${where}
        ORDER BY
          ${sortColumn} ${direction},
          lg.sort_title ASC
      `,
      )
      .all(...parameters) as unknown as LibraryGameRow[];

    return rows.map(mapLibraryGame);
  }

  private getNextSortOrder(): number {
    const row = this.database
      .prepare(
        `
        SELECT MAX(sort_order) AS sort_order
        FROM saved_views
      `,
      )
      .get() as unknown as SortOrderRow;

    return (row.sort_order ?? 0) + 10;
  }

  private requireById(viewId: string): SavedView {
    const view = this.findById(viewId);

    if (view === null) {
      throw new Error(
        `Saved view ${viewId} disappeared during a database operation.`,
      );
    }

    return view;
  }
}
