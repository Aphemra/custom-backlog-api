import { HttpError } from "../../errors/httpError.js";
import {
  playStationPlatforms,
  type PlayStationPlatform,
} from "../library/libraryGameTypes.js";
import { PORTABLE_DATA_FORMAT } from "./portableDataTypes.js";
import { parsePortableDataCore } from "./portableDataCoreValidation.js";
import type {
  PortableCachedImage,
  PortableDataExportV3,
  PortableExternalGameMetadata,
  PortableGameMetadataLink,
  PortableJsonValue,
  PortableLibraryGameImage,
  PortablePlayStationGameLink,
  PortableTrophyAlert,
  PortableTrophySnapshot,
} from "./portableDataV3Types.js";

const MAX_ITEMS = 50_000;
const MAX_JSON_DEPTH = 20;

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
  if (value === null) return null;

  if (typeof value !== "string" || value.length > maxLength) {
    return invalid(`${field} must be null or at most ${maxLength} characters.`);
  }

  return value;
}

function readTimestamp(value: unknown, field: string): string {
  if (typeof value !== "string") {
    return invalid(`${field} must be a normalized ISO timestamp.`);
  }

  const date = new Date(value);

  if (Number.isNaN(date.valueOf()) || date.toISOString() !== value) {
    return invalid(`${field} must be a normalized ISO timestamp.`);
  }

  return value;
}

function readNullableTimestamp(value: unknown, field: string): string | null {
  return value === null ? null : readTimestamp(value, field);
}

function readNonnegativeInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    return invalid(`${field} must be a nonnegative safe integer.`);
  }

  return value as number;
}

function readPercentage(value: unknown, field: string): number {
  const result = readNonnegativeInteger(value, field);

  if (result > 100) {
    invalid(`${field} cannot exceed 100.`);
  }

  return result;
}

function readBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    return invalid(`${field} must be a boolean.`);
  }

  return value;
}

function readHttpsUrl(value: unknown, field: string): string {
  const result = readString(value, field, 4_000);

  let url: URL;

  try {
    url = new URL(result);
  } catch {
    return invalid(`${field} must be a valid HTTPS URL.`);
  }

  if (url.protocol !== "https:") {
    return invalid(`${field} must be a valid HTTPS URL.`);
  }

  return result;
}

function readNullableHttpsUrl(value: unknown, field: string): string | null {
  return value === null ? null : readHttpsUrl(value, field);
}

function readJsonValue(
  value: unknown,
  field: string,
  depth = 0,
): PortableJsonValue {
  if (depth > MAX_JSON_DEPTH) {
    return invalid(`${field} exceeds the maximum JSON depth.`);
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return invalid(`${field} contains a non-finite number.`);
    }

    return value;
  }

  if (Array.isArray(value)) {
    if (value.length > MAX_ITEMS) {
      return invalid(`${field} contains too many items.`);
    }

    return value.map((item, index) =>
      readJsonValue(item, `${field}[${index}]`, depth + 1),
    );
  }

  const record = requireRecord(value, field);
  const keys = Object.keys(record);

  if (keys.length > MAX_ITEMS) {
    return invalid(`${field} contains too many fields.`);
  }

  return Object.fromEntries(
    keys.map((key) => [
      key,
      readJsonValue(record[key], `${field}.${key}`, depth + 1),
    ]),
  );
}

function readPlatforms(
  value: unknown,
  field: string,
): readonly PlayStationPlatform[] {
  const platforms = readArray(value, field).map((platform, index) => {
    if (!playStationPlatforms.includes(platform as PlayStationPlatform)) {
      return invalid(`${field}[${index}] must be PS3, PS4, or PS5.`);
    }

    return platform as PlayStationPlatform;
  });

  if (platforms.length === 0 || new Set(platforms).size !== platforms.length) {
    invalid(`${field} must contain unique PlayStation platforms.`);
  }

  return platforms;
}

function rejectDuplicateValues(values: readonly string[], field: string): void {
  if (new Set(values).size !== values.length) {
    invalid(`${field} cannot contain duplicates.`);
  }
}

function parsePlayStationLink(
  value: unknown,
  index: number,
): PortablePlayStationGameLink {
  const field = `data.playstationGameLinks[${index}]`;
  const record = requireRecord(value, field);

  requireExactKeys(
    record,
    [
      "gameId",
      "npCommunicationId",
      "npServiceName",
      "psnTitleName",
      "platforms",
      "iconUrl",
      "linkSource",
      "payload",
      "linkedAt",
      "firstSeenAt",
      "lastSeenAt",
    ],
    field,
  );

  if (record.npServiceName !== "trophy" && record.npServiceName !== "trophy2") {
    invalid(`${field}.npServiceName is unsupported.`);
  }

  if (
    record.linkSource !== "sync_created" &&
    record.linkSource !== "automatic_match" &&
    record.linkSource !== "manual_match"
  ) {
    invalid(`${field}.linkSource is unsupported.`);
  }

  return {
    gameId: readString(record.gameId, `${field}.gameId`, 200),

    npCommunicationId: readString(
      record.npCommunicationId,
      `${field}.npCommunicationId`,
      200,
    ),

    npServiceName: record.npServiceName,

    psnTitleName: readString(record.psnTitleName, `${field}.psnTitleName`, 200),

    platforms: readPlatforms(record.platforms, `${field}.platforms`),

    iconUrl: readNullableHttpsUrl(record.iconUrl, `${field}.iconUrl`),

    linkSource: record.linkSource,

    payload: readJsonValue(record.payload, `${field}.payload`),

    linkedAt: readTimestamp(record.linkedAt, `${field}.linkedAt`),

    firstSeenAt: readTimestamp(record.firstSeenAt, `${field}.firstSeenAt`),

    lastSeenAt: readTimestamp(record.lastSeenAt, `${field}.lastSeenAt`),
  };
}

function parseExternalMetadata(
  value: unknown,
  index: number,
): PortableExternalGameMetadata {
  const field = `data.externalGameMetadata[${index}]`;
  const record = requireRecord(value, field);

  requireExactKeys(
    record,
    [
      "id",
      "provider",
      "externalId",
      "title",
      "coverUrl",
      "releaseDate",
      "payload",
      "fetchedAt",
    ],
    field,
  );

  return {
    id: readString(record.id, `${field}.id`, 200),

    provider: readString(record.provider, `${field}.provider`, 100),

    externalId: readString(record.externalId, `${field}.externalId`, 200),

    title: readString(record.title, `${field}.title`, 200),

    coverUrl: readNullableHttpsUrl(record.coverUrl, `${field}.coverUrl`),

    releaseDate: readNullableString(
      record.releaseDate,
      `${field}.releaseDate`,
      100,
    ),

    payload: readJsonValue(record.payload, `${field}.payload`),

    fetchedAt: readTimestamp(record.fetchedAt, `${field}.fetchedAt`),
  };
}

function parseMetadataLink(
  value: unknown,
  index: number,
): PortableGameMetadataLink {
  const field = `data.gameMetadataLinks[${index}]`;
  const record = requireRecord(value, field);

  requireExactKeys(record, ["gameId", "metadataId", "linkedAt"], field);

  return {
    gameId: readString(record.gameId, `${field}.gameId`, 200),

    metadataId: readString(record.metadataId, `${field}.metadataId`, 200),

    linkedAt: readTimestamp(record.linkedAt, `${field}.linkedAt`),
  };
}

function parseTrophySnapshot(
  value: unknown,
  index: number,
): PortableTrophySnapshot {
  const field = `data.trophySnapshots[${index}]`;
  const record = requireRecord(value, field);

  requireExactKeys(
    record,
    [
      "id",
      "gameId",
      "capturedAt",
      "bronzeTotal",
      "silverTotal",
      "goldTotal",
      "platinumTotal",
      "bronzeEarned",
      "silverEarned",
      "goldEarned",
      "platinumEarned",
      "progressPercent",
      "is100Percent",
      "hasPlatinum",
      "payload",
    ],
    field,
  );

  const totals = {
    bronze: readNonnegativeInteger(record.bronzeTotal, `${field}.bronzeTotal`),

    silver: readNonnegativeInteger(record.silverTotal, `${field}.silverTotal`),

    gold: readNonnegativeInteger(record.goldTotal, `${field}.goldTotal`),

    platinum: readNonnegativeInteger(
      record.platinumTotal,
      `${field}.platinumTotal`,
    ),
  };

  const earned = {
    bronze: readNonnegativeInteger(
      record.bronzeEarned,
      `${field}.bronzeEarned`,
    ),

    silver: readNonnegativeInteger(
      record.silverEarned,
      `${field}.silverEarned`,
    ),

    gold: readNonnegativeInteger(record.goldEarned, `${field}.goldEarned`),

    platinum: readNonnegativeInteger(
      record.platinumEarned,
      `${field}.platinumEarned`,
    ),
  };

  if (
    earned.bronze > totals.bronze ||
    earned.silver > totals.silver ||
    earned.gold > totals.gold ||
    earned.platinum > totals.platinum
  ) {
    invalid(
      `${field} cannot contain more earned trophies than total trophies.`,
    );
  }

  return {
    id: readString(record.id, `${field}.id`, 200),

    gameId: readString(record.gameId, `${field}.gameId`, 200),

    capturedAt: readTimestamp(record.capturedAt, `${field}.capturedAt`),

    bronzeTotal: totals.bronze,
    silverTotal: totals.silver,
    goldTotal: totals.gold,
    platinumTotal: totals.platinum,

    bronzeEarned: earned.bronze,
    silverEarned: earned.silver,
    goldEarned: earned.gold,
    platinumEarned: earned.platinum,

    progressPercent: readPercentage(
      record.progressPercent,
      `${field}.progressPercent`,
    ),

    is100Percent: readBoolean(record.is100Percent, `${field}.is100Percent`),

    hasPlatinum: readBoolean(record.hasPlatinum, `${field}.hasPlatinum`),

    payload:
      record.payload === null
        ? null
        : readJsonValue(record.payload, `${field}.payload`),
  };
}

function parseTrophyAlert(value: unknown, index: number): PortableTrophyAlert {
  const field = `data.trophyAlerts[${index}]`;
  const record = requireRecord(value, field);

  requireExactKeys(
    record,
    [
      "id",
      "gameId",
      "kind",
      "status",
      "previousSnapshotId",
      "currentSnapshotId",
      "details",
      "createdAt",
      "resolvedAt",
    ],
    field,
  );

  if (record.kind !== "new_trophies" && record.kind !== "completion_lost") {
    invalid(`${field}.kind is unsupported.`);
  }

  const statuses = ["unread", "read", "resolved", "dismissed"] as const;

  if (!statuses.includes(record.status as (typeof statuses)[number])) {
    invalid(`${field}.status is unsupported.`);
  }

  return {
    id: readString(record.id, `${field}.id`, 200),

    gameId: readString(record.gameId, `${field}.gameId`, 200),

    kind: record.kind,

    status: record.status as (typeof statuses)[number],

    previousSnapshotId:
      record.previousSnapshotId === null
        ? null
        : readString(
            record.previousSnapshotId,
            `${field}.previousSnapshotId`,
            200,
          ),

    currentSnapshotId: readString(
      record.currentSnapshotId,
      `${field}.currentSnapshotId`,
      200,
    ),

    details: readJsonValue(record.details, `${field}.details`),

    createdAt: readTimestamp(record.createdAt, `${field}.createdAt`),

    resolvedAt: readNullableTimestamp(record.resolvedAt, `${field}.resolvedAt`),
  };
}

function parseCachedImage(value: unknown, index: number): PortableCachedImage {
  const field = `data.cachedImages[${index}]`;
  const record = requireRecord(value, field);

  requireExactKeys(
    record,
    ["id", "provider", "sourceKey", "sourceUrl", "createdAt", "updatedAt"],
    field,
  );

  if (record.provider !== "igdb" && record.provider !== "playstation") {
    invalid(`${field}.provider is unsupported.`);
  }

  return {
    id: readString(record.id, `${field}.id`, 200),

    provider: record.provider,

    sourceKey: readString(record.sourceKey, `${field}.sourceKey`, 500),

    sourceUrl: readHttpsUrl(record.sourceUrl, `${field}.sourceUrl`),

    createdAt: readTimestamp(record.createdAt, `${field}.createdAt`),

    updatedAt: readTimestamp(record.updatedAt, `${field}.updatedAt`),
  };
}

function parseLibraryGameImage(
  value: unknown,
  index: number,
): PortableLibraryGameImage {
  const field = `data.libraryGameImages[${index}]`;
  const record = requireRecord(value, field);

  requireExactKeys(
    record,
    ["gameId", "imageId", "role", "sortOrder", "linkedAt"],
    field,
  );

  const roles = ["cover", "icon", "background"] as const;

  if (!roles.includes(record.role as (typeof roles)[number])) {
    invalid(`${field}.role is unsupported.`);
  }

  return {
    gameId: readString(record.gameId, `${field}.gameId`, 200),

    imageId: readString(record.imageId, `${field}.imageId`, 200),

    role: record.role as (typeof roles)[number],

    sortOrder: readNonnegativeInteger(record.sortOrder, `${field}.sortOrder`),

    linkedAt: readTimestamp(record.linkedAt, `${field}.linkedAt`),
  };
}

export function parsePortableDataV3(value: unknown): PortableDataExportV3 {
  const root = requireRecord(value, "export");

  requireExactKeys(
    root,
    ["format", "formatVersion", "exportedAt", "data"],
    "export",
  );

  if (root.format !== PORTABLE_DATA_FORMAT || root.formatVersion !== 3) {
    return invalid("The export must use trophy-backlog portable format v3.");
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
    ],
    "data",
  );

  const core = parsePortableDataCore({
    format: PORTABLE_DATA_FORMAT,
    formatVersion: 2,
    exportedAt: root.exportedAt,

    data: {
      libraryGames: data.libraryGames,
      collections: data.collections,
      savedViews: data.savedViews,
    },
  });

  if (core.formatVersion !== 2) {
    throw new Error("Portable v3 core validation returned the wrong version.");
  }

  const playstationGameLinks = readArray(
    data.playstationGameLinks,
    "data.playstationGameLinks",
  ).map(parsePlayStationLink);

  const externalGameMetadata = readArray(
    data.externalGameMetadata,
    "data.externalGameMetadata",
  ).map(parseExternalMetadata);

  const gameMetadataLinks = readArray(
    data.gameMetadataLinks,
    "data.gameMetadataLinks",
  ).map(parseMetadataLink);

  const trophySnapshots = readArray(
    data.trophySnapshots,
    "data.trophySnapshots",
  ).map(parseTrophySnapshot);

  const trophyAlerts = readArray(data.trophyAlerts, "data.trophyAlerts").map(
    parseTrophyAlert,
  );

  const cachedImages = readArray(data.cachedImages, "data.cachedImages").map(
    parseCachedImage,
  );

  const libraryGameImages = readArray(
    data.libraryGameImages,
    "data.libraryGameImages",
  ).map(parseLibraryGameImage);

  rejectDuplicateValues(
    playstationGameLinks.map((link) => link.gameId),
    "data.playstationGameLinks game IDs",
  );

  rejectDuplicateValues(
    playstationGameLinks.map((link) => link.npCommunicationId),
    "data.playstationGameLinks NP communication IDs",
  );

  rejectDuplicateValues(
    externalGameMetadata.map((metadata) => metadata.id),
    "data.externalGameMetadata IDs",
  );

  rejectDuplicateValues(
    externalGameMetadata.map(
      (metadata) => `${metadata.provider}\u0000${metadata.externalId}`,
    ),
    "data.externalGameMetadata provider identities",
  );

  rejectDuplicateValues(
    gameMetadataLinks.map((link) => link.gameId),
    "data.gameMetadataLinks game IDs",
  );

  rejectDuplicateValues(
    trophySnapshots.map((snapshot) => snapshot.id),
    "data.trophySnapshots IDs",
  );

  rejectDuplicateValues(
    trophySnapshots.map(
      (snapshot) => `${snapshot.gameId}\u0000${snapshot.capturedAt}`,
    ),
    "data.trophySnapshots game timestamps",
  );

  rejectDuplicateValues(
    trophyAlerts.map((alert) => alert.id),
    "data.trophyAlerts IDs",
  );

  rejectDuplicateValues(
    trophyAlerts.map(
      (alert) => `${alert.kind}\u0000${alert.currentSnapshotId}`,
    ),
    "data.trophyAlerts current-snapshot kinds",
  );

  rejectDuplicateValues(
    cachedImages.map((image) => image.id),
    "data.cachedImages IDs",
  );

  rejectDuplicateValues(
    cachedImages.map((image) => `${image.provider}\u0000${image.sourceKey}`),
    "data.cachedImages provider keys",
  );

  rejectDuplicateValues(
    libraryGameImages.map(
      (image) => `${image.gameId}\u0000${image.imageId}\u0000${image.role}`,
    ),
    "data.libraryGameImages links",
  );

  const gameIds = new Set(core.data.libraryGames.map((game) => game.id));

  const metadataIds = new Set(
    externalGameMetadata.map((metadata) => metadata.id),
  );

  const snapshotById = new Map(
    trophySnapshots.map((snapshot) => [snapshot.id, snapshot]),
  );

  const imageIds = new Set(cachedImages.map((image) => image.id));

  if (playstationGameLinks.some((link) => !gameIds.has(link.gameId))) {
    invalid("A PlayStation link references a game outside the export.");
  }

  if (
    gameMetadataLinks.some(
      (link) => !gameIds.has(link.gameId) || !metadataIds.has(link.metadataId),
    )
  ) {
    invalid("A metadata link contains a broken reference.");
  }

  if (trophySnapshots.some((snapshot) => !gameIds.has(snapshot.gameId))) {
    invalid("A trophy snapshot references a game outside the export.");
  }

  for (const alert of trophyAlerts) {
    const currentSnapshot = snapshotById.get(alert.currentSnapshotId);

    const previousSnapshot =
      alert.previousSnapshotId === null
        ? null
        : snapshotById.get(alert.previousSnapshotId);

    if (
      !gameIds.has(alert.gameId) ||
      currentSnapshot?.gameId !== alert.gameId ||
      (alert.previousSnapshotId !== null &&
        previousSnapshot?.gameId !== alert.gameId)
    ) {
      invalid(`Trophy alert ${alert.id} contains a broken snapshot reference.`);
    }
  }

  if (
    libraryGameImages.some(
      (link) => !gameIds.has(link.gameId) || !imageIds.has(link.imageId),
    )
  ) {
    invalid("A library image link contains a broken reference.");
  }

  return {
    format: PORTABLE_DATA_FORMAT,
    formatVersion: 3,
    exportedAt: core.exportedAt,

    data: {
      libraryGames: core.data.libraryGames,
      collections: core.data.collections,
      savedViews: core.data.savedViews,
      playstationGameLinks,
      externalGameMetadata,
      gameMetadataLinks,
      trophySnapshots,
      trophyAlerts,
      cachedImages,
      libraryGameImages,
    },
  };
}
