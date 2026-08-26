import { HttpError } from "../../errors/httpError.js";
import {
  playStationApiOperations,
  type PlayStationApiOperations,
  type PlayStationAuthorization,
} from "./playStationApi.js";
import { PlayStationRequestGate } from "./playStationRequestGate.js";
import type {
  PlayStationAccountIdentity,
  PlayStationConnectionResult,
  PlayStationConnectionStatus,
  PlayStationCredentials,
  PlayStationTrophySummary,
} from "./playStationTypes.js";

interface CompleteCredentials {
  readerNpsso: string;
  readerOnlineId: string;
  targetOnlineId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameOnlineId(first: string, second: string): boolean {
  return (
    first.localeCompare(second, undefined, { sensitivity: "accent" }) === 0
  );
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

function throwIfThrottled(value: unknown): void {
  if (isThrottlingFailure(value)) {
    throw new HttpError(
      503,
      "playstation_throttled",
      "PlayStation throttled the request. Wait before trying again.",
    );
  }
}

function throwExternalFailure(
  value: unknown,
  fallbackCode: string,
  fallbackMessage: string,
): never {
  throwIfThrottled(value);

  throw new HttpError(502, fallbackCode, fallbackMessage);
}

function readNonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

export class PlayStationConnectionService {
  private activeConnectionTest: Promise<PlayStationConnectionResult> | null =
    null;

  constructor(
    private readonly credentials: PlayStationCredentials,
    private readonly operations: PlayStationApiOperations = playStationApiOperations,
    private readonly requestGate: PlayStationRequestGate = new PlayStationRequestGate(),
  ) {}

  getStatus(): PlayStationConnectionStatus {
    return {
      configured:
        this.credentials.readerNpsso !== null &&
        this.credentials.readerOnlineId !== null &&
        this.credentials.targetOnlineId !== null,
      readerOnlineId: this.credentials.readerOnlineId,
      targetOnlineId: this.credentials.targetOnlineId,
    };
  }

  testConnection(): Promise<PlayStationConnectionResult> {
    if (this.activeConnectionTest !== null) {
      return this.activeConnectionTest;
    }

    const connectionTest = this.runConnectionTest();
    this.activeConnectionTest = connectionTest;

    connectionTest.then(
      () => {
        if (this.activeConnectionTest === connectionTest) {
          this.activeConnectionTest = null;
        }
      },
      () => {
        if (this.activeConnectionTest === connectionTest) {
          this.activeConnectionTest = null;
        }
      },
    );

    return connectionTest;
  }

  private async runConnectionTest(): Promise<PlayStationConnectionResult> {
    const credentials = this.requireCredentials();
    const requestCountBefore = this.requestGate.requestsUsed;
    const authorization = await this.authenticate(credentials.readerNpsso);
    const authenticatedReaderSummary = await this.readTrophySummary(
      authorization,
      "me",
    );

    const reader: PlayStationAccountIdentity = {
      accountId: authenticatedReaderSummary.accountId,
      onlineId: credentials.readerOnlineId,
    };

    const target = await this.resolveAccount(
      authorization,
      credentials.targetOnlineId,
    );

    if (reader.accountId === target.accountId) {
      throw new HttpError(
        409,
        "playstation_reader_is_target",
        "The reader and target PlayStation accounts must be different.",
      );
    }

    const targetSummary = await this.readTrophySummary(
      authorization,
      target.accountId,
    );

    return {
      reader,
      target,
      targetTrophySummary: targetSummary.summary,
      requestsMade: this.requestGate.requestsUsed - requestCountBefore,
    };
  }

  private requireCredentials(): CompleteCredentials {
    const { readerNpsso, readerOnlineId, targetOnlineId } = this.credentials;

    if (
      readerNpsso === null ||
      readerOnlineId === null ||
      targetOnlineId === null
    ) {
      throw new HttpError(
        503,
        "playstation_not_configured",
        "PlayStation reader and target account settings are incomplete.",
      );
    }

    return { readerNpsso, readerOnlineId, targetOnlineId };
  }

  private async authenticate(npsso: string): Promise<PlayStationAuthorization> {
    let accessCode: unknown;

    try {
      accessCode = await this.requestGate.execute(() =>
        this.operations.exchangeNpssoForAccessCode(npsso),
      );
    } catch (error) {
      throwIfThrottled(error);

      throw new HttpError(
        401,
        "playstation_authentication_failed",
        "PlayStation rejected the reader account NPSSO.",
      );
    }

    if (typeof accessCode !== "string" || accessCode.trim() === "") {
      throw new HttpError(
        401,
        "playstation_authentication_failed",
        "PlayStation rejected the reader account NPSSO.",
      );
    }

    let tokens: unknown;

    try {
      tokens = await this.requestGate.execute(() =>
        this.operations.exchangeAccessCodeForAuthTokens(accessCode),
      );
    } catch (error) {
      throwIfThrottled(error);

      throw new HttpError(
        401,
        "playstation_authentication_failed",
        "PlayStation could not authorize the reader account.",
      );
    }

    if (
      !isRecord(tokens) ||
      typeof tokens.accessToken !== "string" ||
      tokens.accessToken.trim() === ""
    ) {
      throw new HttpError(
        401,
        "playstation_authentication_failed",
        "PlayStation could not authorize the reader account.",
      );
    }

    return { accessToken: tokens.accessToken };
  }

  private async resolveAccount(
    authorization: PlayStationAuthorization,
    onlineId: string,
  ): Promise<PlayStationAccountIdentity> {
    let payload: unknown;

    try {
      payload = await this.requestGate.execute(() =>
        this.operations.searchAccounts(authorization, onlineId),
      );
    } catch (error) {
      throwExternalFailure(
        error,
        "playstation_account_lookup_failed",
        "PlayStation account lookup failed.",
      );
    }

    if (readProviderError(payload) !== null) {
      throwExternalFailure(
        payload,
        "playstation_account_lookup_failed",
        "PlayStation account lookup failed.",
      );
    }

    if (!isRecord(payload) || !Array.isArray(payload.domainResponses)) {
      throw new HttpError(
        502,
        "invalid_playstation_response",
        "PlayStation returned an unexpected account-search response.",
      );
    }

    for (const domain of payload.domainResponses) {
      if (!isRecord(domain) || !Array.isArray(domain.results)) {
        continue;
      }

      for (const result of domain.results) {
        if (!isRecord(result) || !isRecord(result.socialMetadata)) {
          continue;
        }

        const resultOnlineId = result.socialMetadata.onlineId;
        const accountId = result.socialMetadata.accountId;

        if (
          typeof resultOnlineId === "string" &&
          sameOnlineId(resultOnlineId, onlineId)
        ) {
          if (typeof accountId !== "string" || !/^\d+$/.test(accountId)) {
            throw new HttpError(
              502,
              "invalid_playstation_response",
              "PlayStation returned a malformed account identity.",
            );
          }

          return { accountId, onlineId: resultOnlineId };
        }
      }
    }

    throw new HttpError(
      404,
      "playstation_account_not_found",
      `PlayStation could not find the configured account ${onlineId}.`,
    );
  }

  private async readTrophySummary(
    authorization: PlayStationAuthorization,
    accountId: string,
  ): Promise<{ accountId: string; summary: PlayStationTrophySummary }> {
    let payload: unknown;

    try {
      payload = await this.requestGate.execute(() =>
        this.operations.getTrophySummary(authorization, accountId),
      );
    } catch (error) {
      throwExternalFailure(
        error,
        "playstation_trophy_access_failed",
        "PlayStation trophy access failed. Check the target account privacy settings.",
      );
    }

    if (readProviderError(payload) !== null) {
      throwExternalFailure(
        payload,
        "playstation_trophy_access_failed",
        "PlayStation trophy access failed. Check the target account privacy settings.",
      );
    }

    if (!isRecord(payload) || !isRecord(payload.earnedTrophies)) {
      throw new HttpError(
        502,
        "invalid_playstation_response",
        "PlayStation returned an unexpected trophy-summary response.",
      );
    }

    const resolvedAccountId = payload.accountId;
    const trophyLevel = readNonNegativeInteger(payload.trophyLevel);
    const progress = readNonNegativeInteger(payload.progress);
    const tier = readNonNegativeInteger(payload.tier);
    const bronze = readNonNegativeInteger(payload.earnedTrophies.bronze);
    const silver = readNonNegativeInteger(payload.earnedTrophies.silver);
    const gold = readNonNegativeInteger(payload.earnedTrophies.gold);
    const platinum = readNonNegativeInteger(payload.earnedTrophies.platinum);

    if (
      typeof resolvedAccountId !== "string" ||
      !/^\d+$/.test(resolvedAccountId) ||
      trophyLevel === null ||
      progress === null ||
      progress > 100 ||
      tier === null ||
      tier < 1 ||
      tier > 10 ||
      bronze === null ||
      silver === null ||
      gold === null ||
      platinum === null
    ) {
      throw new HttpError(
        502,
        "invalid_playstation_response",
        "PlayStation returned malformed trophy-summary data.",
      );
    }

    return {
      accountId: resolvedAccountId,
      summary: {
        trophyLevel,
        progress,
        tier,
        earnedTrophies: { bronze, silver, gold, platinum },
      },
    };
  }
}
