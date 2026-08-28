import { HttpError } from "../../errors/httpError.js";
import {
  gameResourceProviders,
  gameResourceTypes,
  type GameResourceProvider,
  type GameResourceType,
} from "../resources/gameResourceTypes.js";
import {
  resolveGameResourceTarget,
  type ResolvedGameResourceTarget,
} from "../resources/gameResourceValidation.js";
import { PORTABLE_DATA_FORMAT } from "./portableDataTypes.js";
import { parsePortableDataV4 } from "./portableDataV4Validation.js";
import type {
  PortableDataExportV5,
  PortableGameResource,
} from "./portableDataV5Types.js";

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

function readNullableLabel(value: unknown, field: string): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return invalid(`${field} must be a string or null.`);
  }

  if (value.trim() !== value || value.length === 0 || value.length > 100) {
    return invalid(
      `${field} must be normalized and contain between 1 and 100 characters.`,
    );
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

function readResourceType(value: unknown, field: string): GameResourceType {
  if (!gameResourceTypes.includes(value as GameResourceType)) {
    return invalid(`${field} contains an unsupported resource type.`);
  }

  return value as GameResourceType;
}

function readProvider(value: unknown, field: string): GameResourceProvider {
  if (!gameResourceProviders.includes(value as GameResourceProvider)) {
    return invalid(`${field} contains an unsupported provider.`);
  }

  return value as GameResourceProvider;
}

function resolvePortableTarget(
  resourceType: GameResourceType,
  url: string,
  field: string,
): ResolvedGameResourceTarget {
  try {
    return resolveGameResourceTarget(resourceType, url);
  } catch {
    return invalid(
      `${field} contains an invalid resource URL or provider combination.`,
    );
  }
}

function parseResource(value: unknown, index: number): PortableGameResource {
  const field = `data.gameResources[${index}]`;
  const record = requireRecord(value, field);

  requireExactKeys(
    record,
    [
      "id",
      "gameId",
      "resourceType",
      "provider",
      "url",
      "label",
      "sortOrder",
      "createdAt",
      "updatedAt",
    ],
    field,
  );

  const resourceType = readResourceType(
    record.resourceType,
    `${field}.resourceType`,
  );

  const provider = readProvider(record.provider, `${field}.provider`);

  const url = readString(record.url, `${field}.url`, 2_048);

  const target = resolvePortableTarget(resourceType, url, `${field}.url`);

  if (target.provider !== provider || target.url !== record.url) {
    invalid(
      `${field} does not contain a normalized URL and matching provider.`,
    );
  }

  return {
    id: readString(record.id, `${field}.id`, 200),
    gameId: readString(record.gameId, `${field}.gameId`, 200),
    resourceType,
    provider,
    url: target.url,
    label: readNullableLabel(record.label, `${field}.label`),
    sortOrder: readNonnegativeInteger(record.sortOrder, `${field}.sortOrder`),
    createdAt: readTimestamp(record.createdAt, `${field}.createdAt`),
    updatedAt: readTimestamp(record.updatedAt, `${field}.updatedAt`),
  };
}

export function parsePortableDataV5(value: unknown): PortableDataExportV5 {
  const root = requireRecord(value, "export");

  requireExactKeys(
    root,
    ["format", "formatVersion", "exportedAt", "data"],
    "export",
  );

  if (root.format !== PORTABLE_DATA_FORMAT || root.formatVersion !== 5) {
    return invalid("The export must use trophy-backlog portable format v5.");
  }

  const data = requireRecord(root.data, "data");

  requireExactKeys(
    data,
    [
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
      "gameResources",
    ],
    "data",
  );

  const validatedV4 = parsePortableDataV4({
    format: PORTABLE_DATA_FORMAT,
    formatVersion: 4,
    exportedAt: root.exportedAt,

    data: {
      libraryGames: data.libraryGames,
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

  const gameResources = readArray(data.gameResources, "data.gameResources").map(
    parseResource,
  );

  const resourceIds = new Set<string>();
  const gameUrls = new Set<string>();
  const trophyPageGameIds = new Set<string>();

  const gameIds = new Set(validatedV4.data.libraryGames.map((game) => game.id));

  for (const resource of gameResources) {
    if (resourceIds.has(resource.id)) {
      invalid("data.gameResources cannot contain duplicate IDs.");
    }

    resourceIds.add(resource.id);

    if (!gameIds.has(resource.gameId)) {
      invalid(
        `Game resource ${resource.id} references a game that is not in the export.`,
      );
    }

    const gameUrlKey = `${resource.gameId}:${resource.url}`;

    if (gameUrls.has(gameUrlKey)) {
      invalid(`Game ${resource.gameId} contains a duplicate resource URL.`);
    }

    gameUrls.add(gameUrlKey);

    if (resource.resourceType === "trophy_page") {
      if (trophyPageGameIds.has(resource.gameId)) {
        invalid(
          `Game ${resource.gameId} contains more than one trophy-page resource.`,
        );
      }

      trophyPageGameIds.add(resource.gameId);
    }
  }

  return {
    format: PORTABLE_DATA_FORMAT,
    formatVersion: 5,
    exportedAt: validatedV4.exportedAt,

    data: {
      ...validatedV4.data,
      gameResources,
    },
  };
}
