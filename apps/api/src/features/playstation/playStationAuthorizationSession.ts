import { HttpError } from "../../errors/httpError.js";
import {
  playStationApiOperations,
  type PlayStationApiOperations,
  type PlayStationAuthorization,
} from "./playStationApi.js";
import { PlayStationRequestGate } from "./playStationRequestGate.js";

const EXPIRY_BUFFER_MS = 60_000;

interface CachedTokens {
  accessToken: string;
  accessTokenExpiresAt: number;
  refreshToken: string;
  refreshTokenExpiresAt: number;
}

type Clock = () => number;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPositiveSeconds(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : null;
}

function isThrottlingFailure(value: unknown): boolean {
  if (!(value instanceof Error)) {
    return false;
  }

  const normalized = value.message.toLowerCase();

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

export class PlayStationAuthorizationSession {
  private cachedTokens: CachedTokens | null = null;
  private activeAuthorization: Promise<PlayStationAuthorization> | null = null;

  constructor(
    private readonly readerNpsso: string | null,
    private readonly operations: PlayStationApiOperations = playStationApiOperations,
    private readonly requestGate: PlayStationRequestGate = new PlayStationRequestGate(),
    private readonly clock: Clock = Date.now,
  ) {}

  getAuthorization(): Promise<PlayStationAuthorization> {
    const cachedTokens = this.cachedTokens;

    if (
      cachedTokens !== null &&
      cachedTokens.accessTokenExpiresAt - EXPIRY_BUFFER_MS > this.clock()
    ) {
      return Promise.resolve({
        accessToken: cachedTokens.accessToken,
      });
    }

    if (this.activeAuthorization !== null) {
      return this.activeAuthorization;
    }

    const authorization =
      cachedTokens !== null &&
      cachedTokens.refreshTokenExpiresAt - EXPIRY_BUFFER_MS > this.clock()
        ? this.refreshAuthorization(cachedTokens)
        : this.authenticateWithNpsso();

    this.activeAuthorization = authorization;

    authorization.then(
      () => this.clearActiveAuthorization(authorization),
      () => this.clearActiveAuthorization(authorization),
    );

    return authorization;
  }

  private clearActiveAuthorization(
    authorization: Promise<PlayStationAuthorization>,
  ): void {
    if (this.activeAuthorization === authorization) {
      this.activeAuthorization = null;
    }
  }

  private async authenticateWithNpsso(): Promise<PlayStationAuthorization> {
    const npsso = this.readerNpsso;

    if (npsso === null) {
      throw new HttpError(
        503,
        "playstation_not_configured",
        "The PlayStation reader account NPSSO is not configured.",
      );
    }

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

    let payload: unknown;

    try {
      payload = await this.requestGate.execute(() =>
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

    return this.storeTokens(payload, null);
  }

  private async refreshAuthorization(
    previousTokens: CachedTokens,
  ): Promise<PlayStationAuthorization> {
    let payload: unknown;

    try {
      payload = await this.requestGate.execute(() =>
        this.operations.exchangeRefreshTokenForAuthTokens(
          previousTokens.refreshToken,
        ),
      );
    } catch (error) {
      this.cachedTokens = null;
      throwIfThrottled(error);

      throw new HttpError(
        401,
        "playstation_refresh_failed",
        "PlayStation could not refresh the reader authorization. Try the action again to authenticate afresh.",
      );
    }

    try {
      return this.storeTokens(payload, previousTokens);
    } catch (error) {
      this.cachedTokens = null;
      throw error;
    }
  }

  private storeTokens(
    payload: unknown,
    previousTokens: CachedTokens | null,
  ): PlayStationAuthorization {
    if (!isRecord(payload)) {
      throw this.invalidTokenResponse();
    }

    const accessToken = payload.accessToken;
    const expiresIn = readPositiveSeconds(payload.expiresIn);
    const suppliedRefreshToken = payload.refreshToken;

    const refreshToken =
      typeof suppliedRefreshToken === "string" &&
      suppliedRefreshToken.trim() !== ""
        ? suppliedRefreshToken
        : previousTokens?.refreshToken;

    const refreshTokenExpiresIn = readPositiveSeconds(
      payload.refreshTokenExpiresIn,
    );

    if (
      typeof accessToken !== "string" ||
      accessToken.trim() === "" ||
      expiresIn === null ||
      refreshToken === undefined ||
      (refreshTokenExpiresIn === null && previousTokens === null)
    ) {
      throw this.invalidTokenResponse();
    }

    const now = this.clock();

    this.cachedTokens = {
      accessToken,
      accessTokenExpiresAt: now + expiresIn * 1_000,
      refreshToken,
      refreshTokenExpiresAt:
        refreshTokenExpiresIn === null
          ? (previousTokens as CachedTokens).refreshTokenExpiresAt
          : now + refreshTokenExpiresIn * 1_000,
    };

    return { accessToken };
  }

  private invalidTokenResponse(): HttpError {
    return new HttpError(
      502,
      "invalid_playstation_authentication_response",
      "PlayStation returned malformed authorization data.",
    );
  }
}
