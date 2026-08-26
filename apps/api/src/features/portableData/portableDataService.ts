import type { DatabaseSync } from "node:sqlite";
import { HttpError } from "../../errors/httpError.js";
import {
  createDatabaseBackup,
  type DatabaseBackupResult,
} from "../backups/createDatabaseBackup.js";
import type {
  PlayStationPlatform,
  PursuitStatus,
} from "../library/libraryGameTypes.js";
import {
  PORTABLE_DATA_FORMAT,
  PORTABLE_DATA_VERSION,
  type PortableCollection,
  type PortableDataCounts,
  type PortableDataExport,
  type PortableImportPreview,
  type PortableLibraryGame,
} from "./portableDataTypes.js";

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

interface CountRow {
  count: number;
}

export interface PortableImportResult extends PortableImportPreview {
  readonly importedAt: string;
  readonly backup: DatabaseBackupResult;
}

function mapGame(row: LibraryGameRow): PortableLibraryGame {
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,

    orderedGameIds: gameIdsByCollection.get(row.id) ?? [],
  }));
}

function readCount(database: DatabaseSync, table: string): number {
  const allowedTables = new Set([
    "library_games",
    "collections",
    "collection_games",
    "game_metadata_links",
    "trophy_snapshots",
    "trophy_alerts",
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
  };
}

function getIncomingCounts(
  portableData: PortableDataExport,
): PortableDataCounts {
  return {
    libraryGames: portableData.data.libraryGames.length,

    collections: portableData.data.collections.length,

    memberships: portableData.data.collections.reduce(
      (total, collection) => total + collection.orderedGameIds.length,
      0,
    ),
  };
}

function assertImportWillNotDiscardUnsupportedData(
  database: DatabaseSync,
): void {
  const unsupportedRecordCount =
    readCount(database, "game_metadata_links") +
    readCount(database, "trophy_snapshots") +
    readCount(database, "trophy_alerts");

  if (unsupportedRecordCount > 0) {
    throw new HttpError(
      409,
      "portable_import_would_discard_unsupported_data",
      "This export version cannot preserve existing metadata or trophy history, so the import was stopped.",
    );
  }
}

export function createPortableDataExport(
  database: DatabaseSync,
): PortableDataExport {
  const gameRows = database
    .prepare(
      `
      SELECT
        id,
        title,
        sort_title,
        platform,
        pursuit_status,
        priority_rank,
        notes,
        created_at,
        updated_at,
        archived_at
      FROM library_games
      ORDER BY priority_rank ASC, sort_title ASC
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
      ORDER BY sort_order ASC, name ASC
    `,
    )
    .all() as unknown as CollectionRow[];

  const membershipRows = database
    .prepare(
      `
      SELECT collection_id, game_id
      FROM collection_games
      ORDER BY collection_id ASC, sort_order ASC
    `,
    )
    .all() as unknown as MembershipRow[];

  return {
    format: PORTABLE_DATA_FORMAT,
    formatVersion: PORTABLE_DATA_VERSION,
    exportedAt: new Date().toISOString(),

    data: {
      libraryGames: gameRows.map(mapGame),

      collections: mapCollections(collectionRows, membershipRows),
    },
  };
}

export function previewPortableImport(
  database: DatabaseSync,
  portableData: PortableDataExport,
): PortableImportPreview {
  assertImportWillNotDiscardUnsupportedData(database);

  return {
    formatVersion: portableData.formatVersion,
    exportedAt: portableData.exportedAt,
    incoming: getIncomingCounts(portableData),
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
      priority_rank,
      notes,
      created_at,
      updated_at,
      archived_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

  database.exec("BEGIN IMMEDIATE");

  try {
    database.exec(`
      DELETE FROM collection_games;
      DELETE FROM collections;
      DELETE FROM library_games;
    `);

    for (const game of portableData.data.libraryGames) {
      insertGame.run(
        game.id,
        game.title,
        game.sortTitle,
        game.platform,
        game.pursuitStatus,
        game.priorityRank,
        game.notes,
        game.createdAt,
        game.updatedAt,
        game.archivedAt,
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
