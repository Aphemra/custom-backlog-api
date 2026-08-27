import { HttpError } from "../../errors/httpError.js";
import {
  playStationTrophyDetailApiOperations,
  type PlayStationAuthorization,
  type PlayStationTrophyDetailApiOperations,
} from "./playStationApi.js";
import {
  parsePlayStationTrophyDefinitionsPage,
  parsePlayStationTrophyEarningsPage,
  parsePlayStationTrophyGroups,
} from "./playStationTrophyDetailParser.js";
import { PlayStationRequestGate } from "./playStationRequestGate.js";
import { PlayStationRetryBudget } from "./playStationRetryBudget.js";
import type {
  PlayStationTrophyCounts,
  PlayStationTrophyDefinition,
  PlayStationTrophyDetailFetchResult,
  PlayStationTrophyEarning,
  PlayStationTrophyEarningsFetchResult,
  PlayStationTrophyTitlePreview,
  PlayStationTrophyType,
} from "./playStationTypes.js";

const TROPHY_PAGE_LIMIT = 500;
const MAXIMUM_TROPHY_PAGES = 5;

export interface PlayStationAuthorizationProvider {
  getAuthorization(): Promise<PlayStationAuthorization>;
}

function invalidDetailedResponse(): HttpError {
  return new HttpError(
    502,
    "invalid_playstation_trophy_detail_response",
    "PlayStation returned inconsistent detailed trophy data.",
  );
}

function trophySetChanged(): HttpError {
  return new HttpError(
    409,
    "playstation_trophy_set_changed",
    "The PlayStation trophy set changed during synchronization. Run the synchronization again.",
  );
}

function providerRequestFailed(): HttpError {
  return new HttpError(
    502,
    "playstation_trophy_detail_fetch_failed",
    "PlayStation could not provide detailed trophy data.",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readProviderError(value: unknown): string | null {
  if (!isRecord(value) || !isRecord(value.error)) {
    return null;
  }

  return typeof value.error.message === "string"
    ? value.error.message
    : "PlayStation provider error";
}

function isThrottlingFailure(value: unknown): boolean {
  const message =
    value instanceof Error
      ? value.message
      : typeof value === "string"
        ? value
        : "";

  const normalized = message.toLowerCase();

  return (
    normalized.includes("429") ||
    normalized.includes("too many requests") ||
    normalized.includes("rate limit") ||
    normalized.includes("throttl")
  );
}

function isRetryableFailure(value: unknown): boolean {
  if (!(value instanceof Error) || isThrottlingFailure(value)) {
    return false;
  }

  const normalized = value.message.toLowerCase();

  return (
    normalized.includes("fetch failed") ||
    normalized.includes("econnreset") ||
    normalized.includes("etimedout") ||
    normalized.includes("socket hang up") ||
    normalized.includes("network") ||
    normalized.includes("temporarily unavailable") ||
    normalized.includes("502") ||
    normalized.includes("503") ||
    normalized.includes("504")
  );
}

function throwThrottled(): never {
  throw new HttpError(
    503,
    "playstation_throttled",
    "PlayStation throttled the request. Wait before trying again.",
  );
}

function emptyCounts(): PlayStationTrophyCounts {
  return {
    bronze: 0,
    silver: 0,
    gold: 0,
    platinum: 0,
  };
}

function countsEqual(
  first: PlayStationTrophyCounts,
  second: PlayStationTrophyCounts,
): boolean {
  return (
    first.bronze === second.bronze &&
    first.silver === second.silver &&
    first.gold === second.gold &&
    first.platinum === second.platinum
  );
}

function countTrophies(
  trophies: readonly {
    trophyType: PlayStationTrophyType;
  }[],
): PlayStationTrophyCounts {
  const counts = emptyCounts();

  for (const trophy of trophies) {
    counts[trophy.trophyType] += 1;
  }

  return counts;
}

function assertUniqueTrophyIds(
  trophies: readonly {
    trophyId: number;
  }[],
): void {
  const trophyIds = trophies.map((trophy) => trophy.trophyId);

  if (new Set(trophyIds).size !== trophyIds.length) {
    throw invalidDetailedResponse();
  }
}

export class PlayStationTrophyDetailFetchService {
  constructor(
    private readonly authorizationProvider: PlayStationAuthorizationProvider,
    private readonly operations: PlayStationTrophyDetailApiOperations = playStationTrophyDetailApiOperations,
    private readonly requestGate: PlayStationRequestGate = new PlayStationRequestGate(),
  ) {}

  async fetchTitle(
    accountId: string,
    title: PlayStationTrophyTitlePreview,
  ): Promise<PlayStationTrophyDetailFetchResult> {
    if (accountId.trim() === "") {
      throw new Error(
        "A PlayStation account ID is required to fetch trophy details.",
      );
    }

    const requestCountBefore = this.requestGate.requestsUsed;
    const retryBudget = new PlayStationRetryBudget();
    const authorization = await this.authorizationProvider.getAuthorization();

    const trophySetPayload = await this.executeProviderRequest(
      () =>
        this.operations.getTrophyGroups(
          authorization,
          title.npCommunicationId,
          {
            npServiceName: title.npServiceName,
          },
        ),
      retryBudget,
    );

    const trophySet = parsePlayStationTrophyGroups(trophySetPayload);

    this.assertTitleIdentity(title, trophySet.trophySetVersion);

    if (
      trophySet.hasTrophyGroups !== title.hasTrophyGroups ||
      !countsEqual(trophySet.definedTrophies, title.definedTrophies)
    ) {
      throw invalidDetailedResponse();
    }

    const definitions = await this.fetchDefinitions(
      authorization,
      title,
      retryBudget,
    );

    const earningsResult = await this.fetchEarnings(
      authorization,
      accountId,
      title,
      retryBudget,
    );

    this.validateCompleteResult(
      trophySet.groups.map((group) => ({
        trophyGroupId: group.trophyGroupId,
        definedTrophies: group.definedTrophies,
      })),
      trophySet.definedTrophies,
      definitions,
      earningsResult.earnings,
    );

    return {
      trophySet,
      definitions,
      earnings: earningsResult.earnings,
      lastUpdatedAt: earningsResult.lastUpdatedAt,
      requestsMade: this.requestGate.requestsUsed - requestCountBefore,
      retriesUsed: retryBudget.retriesUsed,
    };
  }

  async fetchEarningsOnly(
    accountId: string,
    title: PlayStationTrophyTitlePreview,
  ): Promise<PlayStationTrophyEarningsFetchResult> {
    if (accountId.trim() === "") {
      throw new Error(
        "A PlayStation account ID is required to fetch trophy earnings.",
      );
    }

    const requestCountBefore = this.requestGate.requestsUsed;
    const retryBudget = new PlayStationRetryBudget();
    const authorization = await this.authorizationProvider.getAuthorization();

    const result = await this.fetchEarnings(
      authorization,
      accountId,
      title,
      retryBudget,
    );

    if (!countsEqual(countTrophies(result.earnings), title.definedTrophies)) {
      throw invalidDetailedResponse();
    }

    return {
      earnings: result.earnings,
      lastUpdatedAt: result.lastUpdatedAt,
      requestsMade: this.requestGate.requestsUsed - requestCountBefore,
      retriesUsed: retryBudget.retriesUsed,
    };
  }

  private async fetchDefinitions(
    authorization: PlayStationAuthorization,
    title: PlayStationTrophyTitlePreview,
    retryBudget: PlayStationRetryBudget,
  ): Promise<PlayStationTrophyDefinition[]> {
    const definitions: PlayStationTrophyDefinition[] = [];
    const seenOffsets = new Set<number>();

    let expectedTotal: number | null = null;
    let offset: number | null = 0;
    let pageCount = 0;

    while (offset !== null) {
      if (seenOffsets.has(offset) || pageCount >= MAXIMUM_TROPHY_PAGES) {
        throw invalidDetailedResponse();
      }

      const currentOffset = offset;

      seenOffsets.add(currentOffset);
      pageCount += 1;

      const payload = await this.executeProviderRequest(
        () =>
          this.operations.getTrophyDefinitions(
            authorization,
            title.npCommunicationId,
            "all",
            {
              npServiceName: title.npServiceName,
              limit: TROPHY_PAGE_LIMIT,
              offset: currentOffset,
            },
          ),
        retryBudget,
      );

      const page = parsePlayStationTrophyDefinitionsPage(payload);

      this.assertTitleIdentity(title, page.trophySetVersion);

      if (page.hasTrophyGroups !== title.hasTrophyGroups) {
        throw invalidDetailedResponse();
      }

      if (expectedTotal !== null && expectedTotal !== page.totalItemCount) {
        throw invalidDetailedResponse();
      }

      expectedTotal ??= page.totalItemCount;
      definitions.push(...page.trophies);

      if (page.nextOffset !== null && page.nextOffset <= currentOffset) {
        throw invalidDetailedResponse();
      }

      offset = page.nextOffset;
    }

    if (expectedTotal === null || definitions.length !== expectedTotal) {
      throw invalidDetailedResponse();
    }

    assertUniqueTrophyIds(definitions);

    return definitions;
  }

  private async fetchEarnings(
    authorization: PlayStationAuthorization,
    accountId: string,
    title: PlayStationTrophyTitlePreview,
    retryBudget: PlayStationRetryBudget,
  ): Promise<{
    earnings: PlayStationTrophyEarning[];
    lastUpdatedAt: string;
  }> {
    const earnings: PlayStationTrophyEarning[] = [];
    const seenOffsets = new Set<number>();

    let expectedTotal: number | null = null;
    let lastUpdatedAt: string | null = null;
    let offset: number | null = 0;
    let pageCount = 0;

    while (offset !== null) {
      if (seenOffsets.has(offset) || pageCount >= MAXIMUM_TROPHY_PAGES) {
        throw invalidDetailedResponse();
      }

      const currentOffset = offset;

      seenOffsets.add(currentOffset);
      pageCount += 1;

      const payload = await this.executeProviderRequest(
        () =>
          this.operations.getTrophyEarnings(
            authorization,
            accountId,
            title.npCommunicationId,
            "all",
            {
              npServiceName: title.npServiceName,
              limit: TROPHY_PAGE_LIMIT,
              offset: currentOffset,
            },
          ),
        retryBudget,
      );

      const page = parsePlayStationTrophyEarningsPage(payload);

      this.assertTitleIdentity(title, page.trophySetVersion);

      if (page.hasTrophyGroups !== title.hasTrophyGroups) {
        throw invalidDetailedResponse();
      }

      if (expectedTotal !== null && expectedTotal !== page.totalItemCount) {
        throw invalidDetailedResponse();
      }

      if (lastUpdatedAt !== null && lastUpdatedAt !== page.lastUpdatedAt) {
        throw invalidDetailedResponse();
      }

      expectedTotal ??= page.totalItemCount;
      lastUpdatedAt ??= page.lastUpdatedAt;
      earnings.push(...page.trophies);

      if (page.nextOffset !== null && page.nextOffset <= currentOffset) {
        throw invalidDetailedResponse();
      }

      offset = page.nextOffset;
    }

    if (
      expectedTotal === null ||
      lastUpdatedAt === null ||
      earnings.length !== expectedTotal
    ) {
      throw invalidDetailedResponse();
    }

    assertUniqueTrophyIds(earnings);

    return {
      earnings,
      lastUpdatedAt,
    };
  }

  private validateCompleteResult(
    groups: readonly {
      trophyGroupId: string;
      definedTrophies: PlayStationTrophyCounts;
    }[],
    definedTrophies: PlayStationTrophyCounts,
    definitions: readonly PlayStationTrophyDefinition[],
    earnings: readonly PlayStationTrophyEarning[],
  ): void {
    if (!countsEqual(countTrophies(definitions), definedTrophies)) {
      throw invalidDetailedResponse();
    }

    const definitionsById = new Map(
      definitions.map((definition) => [definition.trophyId, definition]),
    );

    if (
      definitionsById.size !== definitions.length ||
      earnings.length !== definitions.length
    ) {
      throw invalidDetailedResponse();
    }

    for (const earning of earnings) {
      const definition = definitionsById.get(earning.trophyId);

      if (
        definition === undefined ||
        definition.trophyType !== earning.trophyType
      ) {
        throw invalidDetailedResponse();
      }
    }

    const groupCounts = new Map<string, PlayStationTrophyCounts>(
      groups.map((group) => [group.trophyGroupId, emptyCounts()]),
    );

    for (const definition of definitions) {
      const counts = groupCounts.get(definition.trophyGroupId);

      if (counts === undefined) {
        throw invalidDetailedResponse();
      }

      counts[definition.trophyType] += 1;
    }

    for (const group of groups) {
      const counts = groupCounts.get(group.trophyGroupId);

      if (counts === undefined || !countsEqual(counts, group.definedTrophies)) {
        throw invalidDetailedResponse();
      }
    }
  }

  private assertTitleIdentity(
    title: PlayStationTrophyTitlePreview,
    trophySetVersion: string,
  ): void {
    if (trophySetVersion !== title.trophySetVersion) {
      throw trophySetChanged();
    }
  }

  private async executeProviderRequest(
    operation: () => Promise<unknown>,
    retryBudget: PlayStationRetryBudget,
  ): Promise<unknown> {
    let attemptsMade = 0;

    while (true) {
      attemptsMade += 1;

      try {
        const payload = await this.requestGate.execute(operation);
        const providerError = readProviderError(payload);

        if (providerError !== null) {
          if (isThrottlingFailure(providerError)) {
            throwThrottled();
          }

          throw providerRequestFailed();
        }

        return payload;
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }

        if (isThrottlingFailure(error)) {
          throwThrottled();
        }

        if (!isRetryableFailure(error)) {
          throw providerRequestFailed();
        }

        retryBudget.reserveRetry(attemptsMade);
      }
    }
  }
}
