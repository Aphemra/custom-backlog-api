import { HttpError } from "../../errors/httpError.js";
import {
  createCompatiblePursuitStatus,
  playStationPlatforms,
  playStatuses,
  type PlayStationPlatform,
  type PlayStatus,
} from "../library/libraryGameTypes.js";
import { PORTABLE_DATA_FORMAT } from "./portableDataTypes.js";
import { parsePortableDataV3 } from "./portableDataV3Validation.js";
import type {
  PortableDataExportV4,
  PortableLibraryGameV4,
} from "./portableDataV4Types.js";

const MAX_ITEMS = 50_000;

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
  expectedKeys: readonly string[],
  field: string,
): void {
  const expected = new Set(expectedKeys);
  const actual = Object.keys(record);

  if (
    actual.length !== expected.size ||
    actual.some((key) => !expected.has(key))
  ) {
    invalid(`${field} has missing or unsupported fields.`);
  }
}

function readArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value) || value.length > MAX_ITEMS) {
    return invalid(
      `${field} must be an array containing no more than ${MAX_ITEMS} items.`,
    );
  }

  return value;
}

function readString(
  value: unknown,
  field: string,
  maximumLength: number,
): string {
  if (typeof value !== "string") {
    return invalid(`${field} must be a string.`);
  }

  const result = value.trim();

  if (result.length === 0 || result.length > maximumLength) {
    return invalid(
      `${field} must contain between 1 and ${maximumLength} characters.`,
    );
  }

  return result;
}

function readNullableString(
  value: unknown,
  field: string,
  maximumLength: number,
): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string" || value.length > maximumLength) {
    return invalid(
      `${field} must be null or contain no more than ${maximumLength} characters.`,
    );
  }

  return value;
}

function readTimestamp(value: unknown, field: string): string {
  if (typeof value !== "string") {
    return invalid(`${field} must be an ISO timestamp.`);
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== value) {
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

function readPlayStatus(value: unknown, field: string): PlayStatus {
  if (!playStatuses.includes(value as PlayStatus)) {
    return invalid(`${field} contains an unsupported play status.`);
  }

  return value as PlayStatus;
}

function parseGame(value: unknown, index: number): PortableLibraryGameV4 {
  const field = `data.libraryGames[${index}]`;
  const record = requireRecord(value, field);

  requireExactKeys(
    record,
    [
      "id",
      "title",
      "sortTitle",
      "platform",
      "playStatus",
      "isUnobtainable",
      "priorityRank",
      "notes",
      "createdAt",
      "updatedAt",
      "hiddenAt",
    ],
    field,
  );

  return {
    id: readString(record.id, `${field}.id`, 200),
    title: readString(record.title, `${field}.title`, 200),
    sortTitle: readString(record.sortTitle, `${field}.sortTitle`, 200),
    platform: readPlatform(record.platform, `${field}.platform`),
    playStatus: readPlayStatus(record.playStatus, `${field}.playStatus`),
    isUnobtainable: readBoolean(
      record.isUnobtainable,
      `${field}.isUnobtainable`,
    ),
    priorityRank: readNonnegativeInteger(
      record.priorityRank,
      `${field}.priorityRank`,
    ),
    notes: readNullableString(record.notes, `${field}.notes`, 10_000),
    createdAt: readTimestamp(record.createdAt, `${field}.createdAt`),
    updatedAt: readTimestamp(record.updatedAt, `${field}.updatedAt`),
    hiddenAt:
      record.hiddenAt === null
        ? null
        : readTimestamp(record.hiddenAt, `${field}.hiddenAt`),
  };
}

export function parsePortableDataV4(value: unknown): PortableDataExportV4 {
  const root = requireRecord(value, "export");

  requireExactKeys(
    root,
    ["format", "formatVersion", "exportedAt", "data"],
    "export",
  );

  if (root.format !== PORTABLE_DATA_FORMAT || root.formatVersion !== 4) {
    return invalid("The export must use trophy-backlog portable format v4.");
  }

  const data = requireRecord(root.data, "data");

  const dataKeys = [
    "libraryGames",
    "collections",
    "savedViews",
    "playstationGameLinks",
    "externalGameMetadata",
    "gameMetadataLinks",
    "trophySnapshots",
    "trophyAlerts",
    "cachedImages",
    "libraryGameImages",
  ] as const;

  requireExactKeys(data, dataKeys, "data");

  const libraryGames = readArray(data.libraryGames, "data.libraryGames").map(
    parseGame,
  );

  const validatedV3 = parsePortableDataV3({
    format: PORTABLE_DATA_FORMAT,
    formatVersion: 3,
    exportedAt: root.exportedAt,

    data: {
      libraryGames: libraryGames.map((game) => ({
        id: game.id,
        title: game.title,
        sortTitle: game.sortTitle,
        platform: game.platform,
        pursuitStatus: createCompatiblePursuitStatus(game.playStatus),
        priorityRank: game.priorityRank,
        notes: game.notes,
        createdAt: game.createdAt,
        updatedAt: game.updatedAt,
        archivedAt: game.hiddenAt,
      })),

      collections: data.collections,
      savedViews: data.savedViews,
      playstationGameLinks: data.playstationGameLinks,
      externalGameMetadata: data.externalGameMetadata,
      gameMetadataLinks: data.gameMetadataLinks,
      trophySnapshots: data.trophySnapshots,
      trophyAlerts: data.trophyAlerts,
      cachedImages: data.cachedImages,
      libraryGameImages: data.libraryGameImages,
    },
  });

  return {
    format: PORTABLE_DATA_FORMAT,
    formatVersion: 4,
    exportedAt: validatedV3.exportedAt,

    data: {
      libraryGames,
      collections: validatedV3.data.collections,
      savedViews: validatedV3.data.savedViews,
      playstationGameLinks: validatedV3.data.playstationGameLinks,
      externalGameMetadata: validatedV3.data.externalGameMetadata,
      gameMetadataLinks: validatedV3.data.gameMetadataLinks,
      trophySnapshots: validatedV3.data.trophySnapshots,
      trophyAlerts: validatedV3.data.trophyAlerts,
      cachedImages: validatedV3.data.cachedImages,
      libraryGameImages: validatedV3.data.libraryGameImages,
    },
  };
}
