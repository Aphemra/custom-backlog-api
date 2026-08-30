import type { DatabaseSync } from "node:sqlite";
import { HttpError } from "../../errors/httpError.js";
import { BacklogActivityRecorder } from "../history/backlogActivityRecorder.js";
import {
  createDatabaseBackup,
  type DatabaseBackupResult,
} from "../backups/createDatabaseBackup.js";
import {
  createCompatiblePursuitStatus,
  migratePursuitStatus,
  type PlayStationPlatform,
  type PlayStatus,
  type PursuitStatus,
} from "../library/libraryGameTypes.js";
import { GameResourceRepository } from "../resources/gameResourceRepository.js";
import {
  parseSavedViewFilters,
  parseSavedViewSort,
} from "../savedViews/savedViewValidation.js";
import {
  PORTABLE_DATA_FORMAT,
  PORTABLE_DATA_VERSION,
  type PortableCollection,
  type PortableDataCounts,
  type PortableDataExport,
  type PortableImportPreview,
  type PortableSavedView,
} from "./portableDataTypes.js";
import {
  deletePortableV3IntegrationData,
  insertPortableV3IntegrationData,
  readPortableV3IntegrationData,
} from "./portableDataV3Storage.js";
import { restorePortableIgdbDetails } from "./portableIgdbDetails.js";
import type {
  PortableDataExportV4,
  PortableLibraryGameV4,
} from "./portableDataV4Types.js";
import type { PortableDataExportV5 } from "./portableDataV5Types.js";

interface LibraryGameRow {
  id: string;
  title: string;
  sort_title: string;
  platform: PlayStationPlatform;
  pursuit_status: PursuitStatus;
  play_status: PlayStatus;
  is_unobtainable: number;
  priority_rank: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

interface CollectionRow {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface MembershipRow {
  collection_id: string;
  game_id: string;
}

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

interface CountRow {
  count: number;
}

export interface PortableImportResult extends PortableImportPreview {
  readonly importedAt: string;
  readonly backup: DatabaseBackupResult;
}

function normalizeTimestamp(value: string): string {
  const date = new Date(
    value.includes("T") ? value : `${value.replace(" ", "T")}Z`,
  );

  if (Number.isNaN(date.valueOf())) {
    throw new Error(`Database contains an invalid timestamp: ${value}`);
  }

  return date.toISOString();
}

function mapGame(row: LibraryGameRow): PortableLibraryGameV4 {
  return {
    id: row.id,
    title: row.title,
    sortTitle: row.sort_title,
    platform: row.platform,
    playStatus: row.play_status,
    isUnobtainable: row.is_unobtainable === 1,
    priorityRank: row.priority_rank,
    notes: row.notes,
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),

    hiddenAt:
      row.archived_at === null ? null : normalizeTimestamp(row.archived_at),
  };
}

function mapCollections(
  rows: readonly CollectionRow[],
  memberships: readonly MembershipRow[],
): readonly PortableCollection[] {
  const gameIdsByCollection = new Map<string, string[]>();

  for (const membership of memberships) {
    const gameIds = gameIdsByCollection.get(membership.collection_id) ?? [];

    gameIds.push(membership.game_id);

    gameIdsByCollection.set(membership.collection_id, gameIds);
  }

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    createdAt: normalizeTimestamp(row.created_at),

    updatedAt: normalizeTimestamp(row.updated_at),

    orderedGameIds: gameIdsByCollection.get(row.id) ?? [],
  }));
}

function mapSavedView(row: SavedViewRow): PortableSavedView {
  return {
    id: row.id,
    builtinKey: row.builtin_key,
    name: row.name,

    filters: parseSavedViewFilters(JSON.parse(row.filters_json) as unknown),

    sort: parseSavedViewSort(JSON.parse(row.sort_json) as unknown),

    sortOrder: row.sort_order,
    isBuiltin: row.is_builtin === 1,

    createdAt: normalizeTimestamp(row.created_at),

    updatedAt: normalizeTimestamp(row.updated_at),
  };
}

function readCount(database: DatabaseSync, table: string): number {
  const allowedTables = new Set([
    "library_games",
    "collections",
    "collection_games",
    "saved_views",
    "playstation_game_links",
    "external_game_metadata",
    "game_metadata_links",
    "trophy_snapshots",
    "trophy_alerts",
    "cached_images",
    "library_game_images",
    "game_resources",
  ]);

  if (!allowedTables.has(table)) {
    throw new Error(`Unsupported count table: ${table}`);
  }

  const row = database
    .prepare(`SELECT COUNT(*) AS count FROM ${table}`)
    .get() as unknown as CountRow;

  return row.count;
}

function getCurrentCounts(database: DatabaseSync): PortableDataCounts {
  return {
    libraryGames: readCount(database, "library_games"),
    collections: readCount(database, "collections"),
    memberships: readCount(database, "collection_games"),
    savedViews: readCount(database, "saved_views"),
    playstationLinks: readCount(database, "playstation_game_links"),
    metadataEntries: readCount(database, "external_game_metadata"),
    trophySnapshots: readCount(database, "trophy_snapshots"),
    trophyAlerts: readCount(database, "trophy_alerts"),
    cachedImages: readCount(database, "cached_images"),
    gameResources: readCount(database, "game_resources"),
  };
}

function getIncomingCounts(
  database: DatabaseSync,
  portableData: PortableDataExport,
): PortableDataCounts {
  return {
    libraryGames: portableData.data.libraryGames.length,

    collections: portableData.data.collections.length,

    memberships: portableData.data.collections.reduce(
      (total, collection) => total + collection.orderedGameIds.length,
      0,
    ),

    savedViews:
      portableData.formatVersion !== 1
        ? portableData.data.savedViews.length
        : readCount(database, "saved_views"),

    playstationLinks:
      portableData.formatVersion === 3 ||
      portableData.formatVersion === 4 ||
      portableData.formatVersion === 5
        ? portableData.data.playstationGameLinks.length
        : 0,

    metadataEntries:
      portableData.formatVersion === 3 ||
      portableData.formatVersion === 4 ||
      portableData.formatVersion === 5
        ? portableData.data.externalGameMetadata.length
        : 0,

    trophySnapshots:
      portableData.formatVersion === 3 ||
      portableData.formatVersion === 4 ||
      portableData.formatVersion === 5
        ? portableData.data.trophySnapshots.length
        : 0,

    trophyAlerts:
      portableData.formatVersion === 3 ||
      portableData.formatVersion === 4 ||
      portableData.formatVersion === 5
        ? portableData.data.trophyAlerts.length
        : 0,

    cachedImages:
      portableData.formatVersion === 3 ||
      portableData.formatVersion === 4 ||
      portableData.formatVersion === 5
        ? portableData.data.cachedImages.length
        : 0,

    gameResources:
      portableData.formatVersion === 5
        ? portableData.data.gameResources.length
        : 0,
  };
}

function assertImportWillNotDiscardUnsupportedData(
  database: DatabaseSync,
  portableData: PortableDataExport,
): void {
  if (portableData.formatVersion === 5) {
    return;
  }

  const gameResourceCount = readCount(database, "game_resources");

  if (portableData.formatVersion === 3 || portableData.formatVersion === 4) {
    if (gameResourceCount === 0) {
      return;
    }

    throw new HttpError(
      409,
      "portable_import_would_discard_game_resources",
      "This older export version cannot preserve existing game resources. Export the current app as version five before replacing this data.",
    );
  }

  const unsupportedRecordCount =
    readCount(database, "playstation_game_links") +
    readCount(database, "external_game_metadata") +
    readCount(database, "game_metadata_links") +
    readCount(database, "trophy_snapshots") +
    readCount(database, "trophy_alerts") +
    readCount(database, "cached_images") +
    readCount(database, "library_game_images") +
    gameResourceCount;

  if (unsupportedRecordCount > 0) {
    throw new HttpError(
      409,
      "portable_import_would_discard_unsupported_data",
      "This older export version cannot preserve existing PlayStation, metadata, trophy, alert, or image-cache records, and it cannot preserve game resources, so the import was stopped.",
    );
  }
}

function assertVersionOneCanPreserveSavedViews(
  database: DatabaseSync,
  portableData: PortableDataExport,
): void {
  if (portableData.formatVersion !== 1) {
    return;
  }

  const rows = database
    .prepare(
      `
      SELECT filters_json
      FROM saved_views
      WHERE is_builtin = 0
    `,
    )
    .all() as unknown as Array<{
    filters_json: string;
  }>;

  const hasCollectionDependentView = rows.some((row) => {
    const filters = parseSavedViewFilters(
      JSON.parse(row.filters_json) as unknown,
    );

    return filters.collectionIds !== undefined;
  });

  if (hasCollectionDependentView) {
    throw new HttpError(
      409,
      "portable_v1_cannot_preserve_collection_views",
      "A version-one import could break saved views that use Collections. Export the current app as version five before replacing this data.",
    );
  }
}

export function createPortableDataExport(
  database: DatabaseSync,
): PortableDataExportV5 {
  const gameRows = database
    .prepare(
      `
      SELECT
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
        updated_at,
        archived_at
      FROM library_games
      ORDER BY
        priority_rank ASC,
        sort_title ASC
    `,
    )
    .all() as unknown as LibraryGameRow[];

  const collectionRows = database
    .prepare(
      `
      SELECT
        id,
        name,
        description,
        sort_order,
        created_at,
        updated_at
      FROM collections
      ORDER BY
        sort_order ASC,
        name ASC
    `,
    )
    .all() as unknown as CollectionRow[];

  const membershipRows = database
    .prepare(
      `
      SELECT
        collection_id,
        game_id
      FROM collection_games
      ORDER BY
        collection_id ASC,
        sort_order ASC
    `,
    )
    .all() as unknown as MembershipRow[];

  const savedViewRows = database
    .prepare(
      `
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
      ORDER BY
        sort_order ASC,
        name ASC
    `,
    )
    .all() as unknown as SavedViewRow[];

  const integrationData = readPortableV3IntegrationData(database);

  const resourceRepository = new GameResourceRepository(database);

  const gameResources = gameRows.flatMap((game) =>
    resourceRepository.listByGame(game.id),
  );

  return {
    format: PORTABLE_DATA_FORMAT,

    formatVersion: PORTABLE_DATA_VERSION,

    exportedAt: new Date().toISOString(),

    data: {
      libraryGames: gameRows.map(mapGame),

      collections: mapCollections(collectionRows, membershipRows),

      savedViews: savedViewRows.map(mapSavedView),

      ...integrationData,

      gameResources,
    },
  };
}

export function previewPortableImport(
  database: DatabaseSync,
  portableData: PortableDataExport,
): PortableImportPreview {
  assertImportWillNotDiscardUnsupportedData(database, portableData);

  assertVersionOneCanPreserveSavedViews(database, portableData);

  return {
    formatVersion: portableData.formatVersion,

    exportedAt: portableData.exportedAt,

    incoming: getIncomingCounts(database, portableData),

    current: getCurrentCounts(database),
  };
}

export async function importPortableData(
  database: DatabaseSync,
  backupDirectory: string,
  portableData: PortableDataExport,
): Promise<PortableImportResult> {
  const preview = previewPortableImport(database, portableData);

  const backup = await createDatabaseBackup(database, backupDirectory);

  const insertGame = database.prepare(`
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
      updated_at,
      archived_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertCollection = database.prepare(`
    INSERT INTO collections (
      id,
      name,
      description,
      sort_order,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertMembership = database.prepare(`
    INSERT INTO collection_games (
      collection_id,
      game_id,
      sort_order,
      added_at
    ) VALUES (?, ?, ?, ?)
  `);

  const insertSavedView = database.prepare(`
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertGameResource = database.prepare(`
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
  `);

  database.exec("BEGIN IMMEDIATE");

  try {
    if (
      portableData.formatVersion === 3 ||
      portableData.formatVersion === 4 ||
      portableData.formatVersion === 5
    ) {
      deletePortableV3IntegrationData(database);
    }

    database.exec(`
      DELETE FROM collection_games;
      DELETE FROM collections;
      DELETE FROM library_games;
    `);

    if (portableData.formatVersion !== 1) {
      database.exec("DELETE FROM saved_views;");
    }

    for (const game of portableData.data.libraryGames) {
      const isVersionFour = "playStatus" in game;

      const playStatus = isVersionFour
        ? game.playStatus
        : migratePursuitStatus(game.pursuitStatus);

      const pursuitStatus = isVersionFour
        ? createCompatiblePursuitStatus(game.playStatus)
        : game.pursuitStatus;

      const isUnobtainable = isVersionFour ? game.isUnobtainable : false;

      const hiddenAt = isVersionFour ? game.hiddenAt : game.archivedAt;

      insertGame.run(
        game.id,
        game.title,
        game.sortTitle,
        game.platform,
        pursuitStatus,
        playStatus,
        isUnobtainable ? 1 : 0,
        game.priorityRank,
        game.notes,
        game.createdAt,
        game.updatedAt,
        hiddenAt,
      );
    }

    for (const collection of portableData.data.collections) {
      insertCollection.run(
        collection.id,
        collection.name,
        collection.description,
        collection.sortOrder,
        collection.createdAt,
        collection.updatedAt,
      );

      collection.orderedGameIds.forEach((gameId, index) => {
        insertMembership.run(
          collection.id,
          gameId,
          (index + 1) * 1_000,
          collection.updatedAt,
        );
      });
    }

    if (portableData.formatVersion !== 1) {
      for (const view of portableData.data.savedViews) {
        insertSavedView.run(
          view.id,
          view.builtinKey,
          view.name,
          JSON.stringify(view.filters),
          JSON.stringify(view.sort),
          view.sortOrder,
          view.isBuiltin ? 1 : 0,
          view.createdAt,
          view.updatedAt,
        );
      }
    }

    if (
      portableData.formatVersion === 3 ||
      portableData.formatVersion === 4 ||
      portableData.formatVersion === 5
    ) {
      insertPortableV3IntegrationData(database, portableData.data);

      restorePortableIgdbDetails(
        database,
        portableData.data.externalGameMetadata,
      );
    }

    if (portableData.formatVersion === 5) {
      for (const resource of portableData.data.gameResources) {
        insertGameResource.run(
          resource.id,
          resource.gameId,
          resource.resourceType,
          resource.provider,
          resource.url,
          resource.label,
          resource.sortOrder,
          resource.createdAt,
          resource.updatedAt,
        );
      }
    }

    new BacklogActivityRecorder(
      database,
      "portable_import",
    ).recordBacklogImported({
      libraryGames: preview.incoming.libraryGames,
      collections: preview.incoming.collections,
      savedViews: preview.incoming.savedViews,
    });

    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");

    throw error;
  }

  return {
    ...preview,
    importedAt: new Date().toISOString(),
    backup,
  };
}
