import { HttpError } from "../../errors/httpError.js";
import {
  playStationApiOperations,
  type PlayStationApiOperations,
  type PlayStationAuthorization,
} from "./playStationApi.js";
import { PlayStationAuthorizationSession } from "./playStationAuthorizationSession.js";
import { PlayStationConnectionService } from "./playStationConnectionService.js";
import { PlayStationRequestGate } from "./playStationRequestGate.js";
import type {
  PlayStationTitlePreviewResult,
  PlayStationTrophyCounts,
  PlayStationTrophyPlatform,
  PlayStationTrophyTitlePreview,
} from "./playStationTypes.js";

const TITLE_PAGE_LIMIT = 800;

const SUPPORTED_PLATFORMS = new Set<PlayStationTrophyPlatform>([
  "PS3",
  "PS4",
  "PS5",
]);

interface TrophyTitlePage {
  titles: PlayStationTrophyTitlePreview[];
  providerTitleCount: number;
  excludedTitleCount: number;
  nextOffset: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

function readProviderError(value: unknown): string | null {
  if (!isRecord(value) || !isRecord(value.error)) {
    return null;
  }

  return typeof value.error.message === "string" ? value.error.message : null;
}

function isThrottlingFailure(value: unknown): boolean {
  const message =
    value instanceof Error ? value.message : (readProviderError(value) ?? "");

  const normalized = message.toLowerCase();

  return (
    normalized.includes("429") ||
    normalized.includes("too many requests") ||
    normalized.includes("rate limit") ||
    normalized.includes("throttl")
  );
}

function invalidResponse(): HttpError {
  return new HttpError(
    502,
    "invalid_playstation_response",
    "PlayStation returned malformed trophy-title data.",
  );
}

function readCounts(value: unknown): PlayStationTrophyCounts | null {
  if (!isRecord(value)) {
    return null;
  }

  const bronze = readNonNegativeInteger(value.bronze);
  const silver = readNonNegativeInteger(value.silver);
  const gold = readNonNegativeInteger(value.gold);
  const platinum = readNonNegativeInteger(value.platinum);

  if (
    bronze === null ||
    silver === null ||
    gold === null ||
    platinum === null
  ) {
    return null;
  }

  return { bronze, silver, gold, platinum };
}

function readPlatforms(value: unknown): PlayStationTrophyPlatform[] | null {
  if (typeof value !== "string") {
    return null;
  }

  const platforms = value
    .split(",")
    .map((platform) => platform.trim().toUpperCase())
    .filter((platform): platform is PlayStationTrophyPlatform =>
      SUPPORTED_PLATFORMS.has(platform as PlayStationTrophyPlatform),
    );

  return [...new Set(platforms)];
}

function readHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function readTitle(value: unknown): PlayStationTrophyTitlePreview | null {
  if (!isRecord(value)) {
    throw invalidResponse();
  }

  const npServiceName = value.npServiceName;
  const npCommunicationId = value.npCommunicationId;
  const trophySetVersion = value.trophySetVersion;
  const name = value.trophyTitleName;
  const iconUrl = readHttpsUrl(value.trophyTitleIconUrl);
  const platforms = readPlatforms(value.trophyTitlePlatform);
  const definedTrophies = readCounts(value.definedTrophies);
  const progress = readNonNegativeInteger(value.progress);
  const earnedTrophies = readCounts(value.earnedTrophies);
  const lastUpdatedAt = value.lastUpdatedDateTime;

  if (
    (npServiceName !== "trophy" && npServiceName !== "trophy2") ||
    typeof npCommunicationId !== "string" ||
    npCommunicationId.trim() === "" ||
    typeof trophySetVersion !== "string" ||
    trophySetVersion.trim() === "" ||
    typeof name !== "string" ||
    name.trim() === "" ||
    iconUrl === null ||
    platforms === null ||
    typeof value.hasTrophyGroups !== "boolean" ||
    definedTrophies === null ||
    progress === null ||
    progress > 100 ||
    earnedTrophies === null ||
    typeof value.hiddenFlag !== "boolean" ||
    typeof lastUpdatedAt !== "string" ||
    Number.isNaN(Date.parse(lastUpdatedAt)) ||
    (value.trophyTitleDetail !== undefined &&
      typeof value.trophyTitleDetail !== "string")
  ) {
    throw invalidResponse();
  }

  if (platforms.length === 0) {
    return null;
  }

  return {
    npServiceName,
    npCommunicationId,
    trophySetVersion,
    name,
    detail: value.trophyTitleDetail ?? null,
    iconUrl,
    platforms,
    hasTrophyGroups: value.hasTrophyGroups,
    definedTrophies,
    progress,
    earnedTrophies,
    hidden: value.hiddenFlag,
    lastUpdatedAt,
  };
}

function readPage(payload: unknown): TrophyTitlePage {
  if (
    !isRecord(payload) ||
    !Array.isArray(payload.trophyTitles) ||
    readNonNegativeInteger(payload.totalItemCount) === null
  ) {
    throw invalidResponse();
  }

  const nextOffset =
    payload.nextOffset === undefined
      ? null
      : readNonNegativeInteger(payload.nextOffset);

  if (payload.nextOffset !== undefined && nextOffset === null) {
    throw invalidResponse();
  }

  const titles: PlayStationTrophyTitlePreview[] = [];
  let excludedTitleCount = 0;

  for (const value of payload.trophyTitles) {
    const title = readTitle(value);

    if (title === null) {
      excludedTitleCount += 1;
    } else {
      titles.push(title);
    }
  }

  return {
    titles,
    providerTitleCount: payload.totalItemCount as number,
    excludedTitleCount,
    nextOffset,
  };
}

export class PlayStationTitlePreviewService {
  private activePreview: Promise<PlayStationTitlePreviewResult> | null = null;

  constructor(
    private readonly connectionService: PlayStationConnectionService,
    private readonly authorizationSession: PlayStationAuthorizationSession,
    private readonly operations: PlayStationApiOperations = playStationApiOperations,
    private readonly requestGate: PlayStationRequestGate = new PlayStationRequestGate(),
  ) {}

  previewTitles(): Promise<PlayStationTitlePreviewResult> {
    if (this.activePreview !== null) {
      return this.activePreview;
    }

    const preview = this.runPreview();
    this.activePreview = preview;

    preview.then(
      () => this.clearActivePreview(preview),
      () => this.clearActivePreview(preview),
    );

    return preview;
  }

  private clearActivePreview(
    preview: Promise<PlayStationTitlePreviewResult>,
  ): void {
    if (this.activePreview === preview) {
      this.activePreview = null;
    }
  }

  private async runPreview(): Promise<PlayStationTitlePreviewResult> {
    const requestCountBefore = this.requestGate.requestsUsed;

    const connection = await this.connectionService.testConnection();
    const authorization = await this.authorizationSession.getAuthorization();

    const titles: PlayStationTrophyTitlePreview[] = [];
    const seenOffsets = new Set<number>();

    let providerTitleCount: number | null = null;
    let excludedTitleCount = 0;
    let offset: number | null = 0;

    while (offset !== null) {
      if (seenOffsets.has(offset)) {
        throw invalidResponse();
      }

      seenOffsets.add(offset);

      const page = await this.fetchPage(
        authorization,
        connection.target.accountId,
        offset,
      );

      if (
        providerTitleCount !== null &&
        providerTitleCount !== page.providerTitleCount
      ) {
        throw invalidResponse();
      }

      providerTitleCount ??= page.providerTitleCount;
      titles.push(...page.titles);
      excludedTitleCount += page.excludedTitleCount;
      offset = page.nextOffset;
    }

    if (titles.length + excludedTitleCount !== providerTitleCount) {
      throw invalidResponse();
    }

    const identities = new Set(
      titles.map(
        (title) => `${title.npServiceName}:${title.npCommunicationId}`,
      ),
    );

    if (identities.size !== titles.length) {
      throw invalidResponse();
    }

    return {
      target: connection.target,
      providerTitleCount,
      supportedTitleCount: titles.length,
      excludedTitleCount,
      titles,
      requestsMade: this.requestGate.requestsUsed - requestCountBefore,
    };
  }

  private async fetchPage(
    authorization: PlayStationAuthorization,
    accountId: string,
    offset: number,
  ): Promise<TrophyTitlePage> {
    let payload: unknown;

    try {
      payload = await this.requestGate.execute(() =>
        this.operations.getTrophyTitles(authorization, accountId, {
          limit: TITLE_PAGE_LIMIT,
          offset,
        }),
      );
    } catch (error) {
      if (isThrottlingFailure(error)) {
        throw new HttpError(
          503,
          "playstation_throttled",
          "PlayStation throttled the request. Wait before trying again.",
        );
      }

      throw new HttpError(
        502,
        "playstation_title_preview_failed",
        "PlayStation trophy-title preview failed.",
      );
    }

    if (readProviderError(payload) !== null) {
      if (isThrottlingFailure(payload)) {
        throw new HttpError(
          503,
          "playstation_throttled",
          "PlayStation throttled the request. Wait before trying again.",
        );
      }

      throw new HttpError(
        502,
        "playstation_title_preview_failed",
        "PlayStation trophy-title preview failed.",
      );
    }

    return readPage(payload);
  }
}
