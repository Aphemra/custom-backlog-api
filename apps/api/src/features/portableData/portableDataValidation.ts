import { HttpError } from "../../errors/httpError.js";
import {
  playStationPlatforms,
  pursuitStatuses,
  type PlayStationPlatform,
  type PursuitStatus,
} from "../library/libraryGameTypes.js";
import {
  parseSavedViewFilters,
  parseSavedViewSort,
} from "../savedViews/savedViewValidation.js";
import {
  PORTABLE_DATA_FORMAT,
  PORTABLE_DATA_VERSION,
  type PortableCollection,
  type PortableDataExport,
  type PortableLibraryGame,
  type PortableSavedView,
} from "./portableDataTypes.js";

const MAX_ITEMS = 50_000;

const BUILTIN_VIEW_KEYS = new Set([
  "all_games",
  "pursuing_soon",
  "in_progress",
  "platinum_earned",
  "one_hundred_percent",
  "completion_lost",
  "needs_sync",
]);

function invalid(message: string): never {
  throw new HttpError(400, "invalid_portable_data", message);
}

function requireRecord(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return invalid(`${field} must be a JSON object.`);
  }

  return value as Record<string, unknown>;
}

function requireExactKeys(
  record: Record<string, unknown>,
  keys: readonly string[],
  field: string,
): void {
  const expected = new Set(keys);
  const actualKeys = Object.keys(record);

  if (
    actualKeys.length !== expected.size ||
    actualKeys.some((key) => !expected.has(key))
  ) {
    invalid(`${field} has missing or unsupported fields.`);
  }
}

function readString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") {
    return invalid(`${field} must be a string.`);
  }

  const result = value.trim();

  if (result.length === 0 || result.length > maxLength) {
    return invalid(
      `${field} must contain between 1 and ${maxLength} characters.`,
    );
  }

  return result;
}

function readNullableString(
  value: unknown,
  field: string,
  maxLength: number,
): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return invalid(`${field} must be a string or null.`);
  }

  if (value.length > maxLength) {
    return invalid(`${field} cannot exceed ${maxLength} characters.`);
  }

  return value;
}

function readTimestamp(value: unknown, field: string): string {
  if (typeof value !== "string") {
    return invalid(`${field} must be an ISO timestamp.`);
  }

  const date = new Date(value);

  if (Number.isNaN(date.valueOf()) || date.toISOString() !== value) {
    return invalid(`${field} must be a normalized ISO timestamp.`);
  }

  return value;
}

function readNonnegativeInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    return invalid(`${field} must be a nonnegative safe integer.`);
  }

  return value as number;
}

function readBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    return invalid(`${field} must be a boolean.`);
  }

  return value;
}

function readPlatform(value: unknown, field: string): PlayStationPlatform {
  if (!playStationPlatforms.includes(value as PlayStationPlatform)) {
    return invalid(`${field} must be PS3, PS4, or PS5.`);
  }

  return value as PlayStationPlatform;
}

function readPursuitStatus(value: unknown, field: string): PursuitStatus {
  if (!pursuitStatuses.includes(value as PursuitStatus)) {
    return invalid(`${field} contains an unsupported pursuit status.`);
  }

  return value as PursuitStatus;
}

function readArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value) || value.length > MAX_ITEMS) {
    return invalid(
      `${field} must be an array containing no more than ${MAX_ITEMS} items.`,
    );
  }

  return value;
}

function parseGame(value: unknown, index: number): PortableLibraryGame {
  const field = `data.libraryGames[${index}]`;

  const record = requireRecord(value, field);

  requireExactKeys(
    record,
    [
      "id",
      "title",
      "sortTitle",
      "platform",
      "pursuitStatus",
      "priorityRank",
      "notes",
      "createdAt",
      "updatedAt",
      "archivedAt",
    ],
    field,
  );

  return {
    id: readString(record.id, `${field}.id`, 200),

    title: readString(record.title, `${field}.title`, 200),

    sortTitle: readString(record.sortTitle, `${field}.sortTitle`, 200),

    platform: readPlatform(record.platform, `${field}.platform`),

    pursuitStatus: readPursuitStatus(
      record.pursuitStatus,
      `${field}.pursuitStatus`,
    ),

    priorityRank: readNonnegativeInteger(
      record.priorityRank,
      `${field}.priorityRank`,
    ),

    notes: readNullableString(record.notes, `${field}.notes`, 10_000),

    createdAt: readTimestamp(record.createdAt, `${field}.createdAt`),

    updatedAt: readTimestamp(record.updatedAt, `${field}.updatedAt`),

    archivedAt:
      record.archivedAt === null
        ? null
        : readTimestamp(record.archivedAt, `${field}.archivedAt`),
  };
}

function parseCollection(value: unknown, index: number): PortableCollection {
  const field = `data.collections[${index}]`;

  const record = requireRecord(value, field);

  requireExactKeys(
    record,
    [
      "id",
      "name",
      "description",
      "sortOrder",
      "createdAt",
      "updatedAt",
      "orderedGameIds",
    ],
    field,
  );

  const orderedGameIds = readArray(
    record.orderedGameIds,
    `${field}.orderedGameIds`,
  ).map((gameId, gameIndex) =>
    readString(gameId, `${field}.orderedGameIds[${gameIndex}]`, 200),
  );

  if (new Set(orderedGameIds).size !== orderedGameIds.length) {
    invalid(`${field}.orderedGameIds cannot contain duplicate IDs.`);
  }

  return {
    id: readString(record.id, `${field}.id`, 200),

    name: readString(record.name, `${field}.name`, 100),

    description: readNullableString(
      record.description,
      `${field}.description`,
      2_000,
    ),

    sortOrder: readNonnegativeInteger(record.sortOrder, `${field}.sortOrder`),

    createdAt: readTimestamp(record.createdAt, `${field}.createdAt`),

    updatedAt: readTimestamp(record.updatedAt, `${field}.updatedAt`),

    orderedGameIds,
  };
}

function parseSavedView(value: unknown, index: number): PortableSavedView {
  const field = `data.savedViews[${index}]`;

  const record = requireRecord(value, field);

  requireExactKeys(
    record,
    [
      "id",
      "builtinKey",
      "name",
      "filters",
      "sort",
      "sortOrder",
      "isBuiltin",
      "createdAt",
      "updatedAt",
    ],
    field,
  );

  const isBuiltin = readBoolean(record.isBuiltin, `${field}.isBuiltin`);

  const builtinKey =
    record.builtinKey === null
      ? null
      : readString(record.builtinKey, `${field}.builtinKey`, 100);

  if (
    (isBuiltin && builtinKey === null) ||
    (!isBuiltin && builtinKey !== null)
  ) {
    invalid(`${field}.builtinKey must be present only when isBuiltin is true.`);
  }

  if (builtinKey !== null && !BUILTIN_VIEW_KEYS.has(builtinKey)) {
    invalid(`${field}.builtinKey is unsupported.`);
  }

  return {
    id: readString(record.id, `${field}.id`, 200),

    builtinKey,

    name: readString(record.name, `${field}.name`, 100),

    filters: parseSavedViewFilters(record.filters),

    sort: parseSavedViewSort(record.sort),

    sortOrder: readNonnegativeInteger(record.sortOrder, `${field}.sortOrder`),

    isBuiltin,

    createdAt: readTimestamp(record.createdAt, `${field}.createdAt`),

    updatedAt: readTimestamp(record.updatedAt, `${field}.updatedAt`),
  };
}

function rejectDuplicateIds(
  items: readonly {
    readonly id: string;
  }[],
  field: string,
): void {
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    invalid(`${field} cannot contain duplicate IDs.`);
  }
}

export function parsePortableDataExport(value: unknown): PortableDataExport {
  const root = requireRecord(value, "export");

  requireExactKeys(
    root,
    ["format", "formatVersion", "exportedAt", "data"],
    "export",
  );

  if (root.format !== PORTABLE_DATA_FORMAT) {
    invalid(`format must be ${PORTABLE_DATA_FORMAT}.`);
  }

  if (
    root.formatVersion !== 1 &&
    root.formatVersion !== PORTABLE_DATA_VERSION
  ) {
    throw new HttpError(
      400,
      "unsupported_portable_data_version",
      `This app supports portable data versions 1 through ${PORTABLE_DATA_VERSION}.`,
    );
  }

  const data = requireRecord(root.data, "data");

  const isVersionTwo = root.formatVersion === PORTABLE_DATA_VERSION;

  requireExactKeys(
    data,
    isVersionTwo
      ? ["libraryGames", "collections", "savedViews"]
      : ["libraryGames", "collections"],
    "data",
  );

  const libraryGames = readArray(data.libraryGames, "data.libraryGames").map(
    parseGame,
  );

  const collections = readArray(data.collections, "data.collections").map(
    parseCollection,
  );

  rejectDuplicateIds(libraryGames, "data.libraryGames");

  rejectDuplicateIds(collections, "data.collections");

  const gameIds = new Set(libraryGames.map((game) => game.id));

  for (const collection of collections) {
    if (collection.orderedGameIds.some((gameId) => !gameIds.has(gameId))) {
      invalid(
        `Collection ${collection.id} references a game that is not in the export.`,
      );
    }
  }

  const exportedAt = readTimestamp(root.exportedAt, "exportedAt");

  if (!isVersionTwo) {
    return {
      format: PORTABLE_DATA_FORMAT,
      formatVersion: 1,
      exportedAt,
      data: {
        libraryGames,
        collections,
      },
    };
  }

  const savedViews = readArray(data.savedViews, "data.savedViews").map(
    parseSavedView,
  );

  rejectDuplicateIds(savedViews, "data.savedViews");

  const builtinKeys = savedViews
    .filter((view) => view.isBuiltin)
    .map((view) => view.builtinKey);

  if (
    builtinKeys.length !== BUILTIN_VIEW_KEYS.size ||
    new Set(builtinKeys).size !== BUILTIN_VIEW_KEYS.size ||
    builtinKeys.some((key) => key === null || !BUILTIN_VIEW_KEYS.has(key))
  ) {
    invalid("data.savedViews must contain each built-in view exactly once.");
  }

  const collectionIds = new Set(collections.map((collection) => collection.id));

  for (const view of savedViews) {
    if (
      view.filters.collectionIds?.some(
        (collectionId) => !collectionIds.has(collectionId),
      )
    ) {
      invalid(
        `Saved view ${view.id} references a Collection that is not in the export.`,
      );
    }
  }

  return {
    format: PORTABLE_DATA_FORMAT,
    formatVersion: PORTABLE_DATA_VERSION,
    exportedAt,
    data: {
      libraryGames,
      collections,
      savedViews,
    },
  };
}
