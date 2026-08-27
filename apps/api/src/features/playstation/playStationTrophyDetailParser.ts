import { HttpError } from "../../errors/httpError.js";
import type {
  PlayStationTrophyCounts,
  PlayStationTrophyDefinition,
  PlayStationTrophyDefinitionPage,
  PlayStationTrophyEarning,
  PlayStationTrophyEarningsPage,
  PlayStationTrophyGroupDefinition,
  PlayStationTrophyPlatform,
  PlayStationTrophyRarity,
  PlayStationTrophySetDefinition,
  PlayStationTrophyType,
} from "./playStationTypes.js";

const SUPPORTED_PLATFORMS = new Set<PlayStationTrophyPlatform>([
  "PS3",
  "PS4",
  "PS5",
]);

const TROPHY_TYPES = new Set<PlayStationTrophyType>([
  "bronze",
  "silver",
  "gold",
  "platinum",
]);

function invalidResponse(): HttpError {
  return new HttpError(
    502,
    "invalid_playstation_trophy_detail_response",
    "PlayStation returned malformed detailed trophy data.",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw invalidResponse();
  }

  return value;
}

function readRequiredString(
  record: Readonly<Record<string, unknown>>,
  key: string,
): string {
  const value = record[key];

  if (typeof value !== "string" || value.trim() === "") {
    throw invalidResponse();
  }

  return value;
}

function readOptionalString(
  record: Readonly<Record<string, unknown>>,
  key: string,
): string | null {
  const value = record[key];

  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw invalidResponse();
  }

  return value;
}

function readRequiredBoolean(
  record: Readonly<Record<string, unknown>>,
  key: string,
): boolean {
  const value = record[key];

  if (typeof value !== "boolean") {
    throw invalidResponse();
  }

  return value;
}

function readNonNegativeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw invalidResponse();
  }

  return value;
}

function readOptionalNonNegativeInteger(value: unknown): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  return readNonNegativeInteger(value);
}

function readCounts(value: unknown): PlayStationTrophyCounts {
  const record = readRecord(value);
  const bronze = readNonNegativeInteger(record.bronze);
  const silver = readNonNegativeInteger(record.silver);
  const gold = readNonNegativeInteger(record.gold);
  const platinum = readNonNegativeInteger(record.platinum);

  if (platinum > 1) {
    throw invalidResponse();
  }

  return {
    bronze,
    silver,
    gold,
    platinum,
  };
}

function readRequiredHttpsUrl(
  record: Readonly<Record<string, unknown>>,
  key: string,
): string {
  const value = readRequiredString(record, key);

  try {
    const url = new URL(value);

    if (url.protocol !== "https:") {
      throw invalidResponse();
    }

    return url.toString();
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw invalidResponse();
  }
}

function readOptionalHttpsUrl(
  record: Readonly<Record<string, unknown>>,
  key: string,
): string | null {
  const value = record[key];

  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string" || value.trim() === "") {
    throw invalidResponse();
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "https:") {
      throw invalidResponse();
    }

    return url.toString();
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw invalidResponse();
  }
}

function readRequiredIsoDate(
  record: Readonly<Record<string, unknown>>,
  key: string,
): string {
  const value = readRequiredString(record, key);

  if (Number.isNaN(Date.parse(value))) {
    throw invalidResponse();
  }

  return value;
}

function readOptionalIsoDate(
  record: Readonly<Record<string, unknown>>,
  key: string,
): string | null {
  const value = record[key];

  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw invalidResponse();
  }

  return value;
}

function readPlatforms(value: unknown): PlayStationTrophyPlatform[] {
  if (typeof value !== "string") {
    throw invalidResponse();
  }

  const platforms = value
    .split(",")
    .map((platform) => platform.trim().toUpperCase())
    .filter((platform): platform is PlayStationTrophyPlatform =>
      SUPPORTED_PLATFORMS.has(platform as PlayStationTrophyPlatform),
    );

  const uniquePlatforms = [...new Set(platforms)];

  if (uniquePlatforms.length === 0) {
    throw invalidResponse();
  }

  return uniquePlatforms;
}

function readTrophyType(value: unknown): PlayStationTrophyType {
  if (
    typeof value !== "string" ||
    !TROPHY_TYPES.has(value as PlayStationTrophyType)
  ) {
    throw invalidResponse();
  }

  return value as PlayStationTrophyType;
}

function readOptionalRarity(value: unknown): PlayStationTrophyRarity | null {
  const rarity = readOptionalNonNegativeInteger(value);

  if (rarity === null) {
    return null;
  }

  if (rarity > 3) {
    throw invalidResponse();
  }

  return rarity as PlayStationTrophyRarity;
}

function readOptionalPercentage(value: unknown): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  let percentage: number;

  if (typeof value === "number") {
    percentage = value;
  } else if (typeof value === "string" && value.trim() !== "") {
    percentage = Number(value);
  } else {
    throw invalidResponse();
  }

  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    throw invalidResponse();
  }

  return percentage;
}

function readOptionalWholeNumberText(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return String(value);
  }

  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return value.trim();
  }

  throw invalidResponse();
}

function readNextOffset(
  record: Readonly<Record<string, unknown>>,
): number | null {
  if (record.nextOffset === undefined) {
    return null;
  }

  return readNonNegativeInteger(record.nextOffset);
}

function assertUniqueIds(ids: readonly (number | string)[]): void {
  if (new Set(ids).size !== ids.length) {
    throw invalidResponse();
  }
}

function readGroup(value: unknown): PlayStationTrophyGroupDefinition {
  const record = readRecord(value);

  return {
    trophyGroupId: readRequiredString(record, "trophyGroupId"),
    name: readRequiredString(record, "trophyGroupName"),
    detail: readOptionalString(record, "trophyGroupDetail"),
    iconUrl: readRequiredHttpsUrl(record, "trophyGroupIconUrl"),
    definedTrophies: readCounts(record.definedTrophies),
    providerPayload: record,
  };
}

function readDefinition(value: unknown): PlayStationTrophyDefinition {
  const record = readRecord(value);

  return {
    trophyId: readNonNegativeInteger(record.trophyId),
    trophyGroupId: readRequiredString(record, "trophyGroupId"),
    trophyType: readTrophyType(record.trophyType),
    hidden: readRequiredBoolean(record, "trophyHidden"),
    name: readOptionalString(record, "trophyName"),
    detail: readOptionalString(record, "trophyDetail"),
    iconUrl: readOptionalHttpsUrl(record, "trophyIconUrl"),
    providerPayload: record,
  };
}

function readEarning(value: unknown): PlayStationTrophyEarning {
  const record = readRecord(value);
  const earned = readRequiredBoolean(record, "earned");
  const earnedAt = readOptionalIsoDate(record, "earnedDateTime");

  if (!earned && earnedAt !== null) {
    throw invalidResponse();
  }

  return {
    trophyId: readNonNegativeInteger(record.trophyId),
    trophyType: readTrophyType(record.trophyType),
    hidden: readRequiredBoolean(record, "trophyHidden"),
    earned,
    earnedAt,
    rarity: readOptionalRarity(record.trophyRare),
    earnedRate: readOptionalPercentage(record.trophyEarnedRate),
    progressTargetValue: readOptionalWholeNumberText(
      record.trophyProgressTargetValue,
    ),
    progressValue: readOptionalWholeNumberText(record.progress),
    progressRate: readOptionalPercentage(record.progressRate),
    rewardName: readOptionalString(record, "trophyRewardName"),
    rewardImageUrl: readOptionalHttpsUrl(record, "trophyRewardImageUrl"),
    providerPayload: record,
  };
}

export function parsePlayStationTrophyGroups(
  payload: unknown,
): PlayStationTrophySetDefinition {
  const record = readRecord(payload);

  if (!Array.isArray(record.trophyGroups)) {
    throw invalidResponse();
  }

  const groups = record.trophyGroups.map(readGroup);

  if (groups.length === 0) {
    throw invalidResponse();
  }

  assertUniqueIds(groups.map((group) => group.trophyGroupId));

  if (!groups.some((group) => group.trophyGroupId === "default")) {
    throw invalidResponse();
  }

  return {
    trophySetVersion: readRequiredString(record, "trophySetVersion"),
    titleName: readRequiredString(record, "trophyTitleName"),
    titleDetail: readOptionalString(record, "trophyTitleDetail"),
    titleIconUrl: readRequiredHttpsUrl(record, "trophyTitleIconUrl"),
    platforms: readPlatforms(record.trophyTitlePlatform),
    hasTrophyGroups: groups.some((group) => group.trophyGroupId !== "default"),
    definedTrophies: readCounts(record.definedTrophies),
    groups,
    providerPayload: record,
  };
}

export function parsePlayStationTrophyDefinitionsPage(
  payload: unknown,
): PlayStationTrophyDefinitionPage {
  const record = readRecord(payload);

  if (!Array.isArray(record.trophies)) {
    throw invalidResponse();
  }

  const trophies = record.trophies.map(readDefinition);
  const totalItemCount = readNonNegativeInteger(record.totalItemCount);

  if (trophies.length > totalItemCount) {
    throw invalidResponse();
  }

  assertUniqueIds(trophies.map((trophy) => trophy.trophyId));

  return {
    trophySetVersion: readRequiredString(record, "trophySetVersion"),
    hasTrophyGroups: readRequiredBoolean(record, "hasTrophyGroups"),
    trophies,
    totalItemCount,
    nextOffset: readNextOffset(record),
    providerPayload: record,
  };
}

export function parsePlayStationTrophyEarningsPage(
  payload: unknown,
): PlayStationTrophyEarningsPage {
  const record = readRecord(payload);

  if (!Array.isArray(record.trophies)) {
    throw invalidResponse();
  }

  const trophies = record.trophies.map(readEarning);
  const totalItemCount = readNonNegativeInteger(record.totalItemCount);

  if (trophies.length > totalItemCount) {
    throw invalidResponse();
  }

  assertUniqueIds(trophies.map((trophy) => trophy.trophyId));

  return {
    trophySetVersion: readRequiredString(record, "trophySetVersion"),
    hasTrophyGroups: readRequiredBoolean(record, "hasTrophyGroups"),
    lastUpdatedAt: readRequiredIsoDate(record, "lastUpdatedDateTime"),
    trophies,
    totalItemCount,
    nextOffset: readNextOffset(record),
    providerPayload: record,
  };
}
