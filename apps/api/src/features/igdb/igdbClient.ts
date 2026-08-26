import { HttpError } from "../../errors/httpError.js";
import type { PlayStationPlatform } from "../library/libraryGameTypes.js";
import type { IgdbCredentials, IgdbGame } from "./igdbTypes.js";

const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const IGDB_GAMES_URL = "https://api.igdb.com/v4/games";
const MINIMUM_REQUEST_INTERVAL_MS = 275;
const TOKEN_EXPIRY_BUFFER_MS = 60_000;
const GAME_FIELDS =
  "fields id,name,summary,cover.image_id,parent_game,platforms.id," +
  "release_dates.date,release_dates.platform;";

const playStationPlatforms = new Map<number, PlayStationPlatform>([
  [9, "PS3"],
  [48, "PS4"],
  [167, "PS5"],
]);

export type IgdbFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

interface AccessToken {
  value: string;
  expiresAt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPlatformId(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (isRecord(value) && typeof value.id === "number") {
    return Number.isInteger(value.id) ? value.id : null;
  }

  return null;
}

function readPlatforms(value: unknown): readonly PlayStationPlatform[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const platforms = value
    .map(readPlatformId)
    .map((platformId) =>
      platformId === null ? undefined : playStationPlatforms.get(platformId),
    )
    .filter(
      (platform): platform is PlayStationPlatform => platform !== undefined,
    );

  return [...new Set(platforms)];
}

function readReleaseDate(value: unknown): string | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const dates = value.flatMap((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.date !== "number" ||
      !Number.isSafeInteger(entry.date) ||
      entry.date <= 0
    ) {
      return [];
    }

    const platformId = readPlatformId(entry.platform);

    return platformId !== null && playStationPlatforms.has(platformId)
      ? [entry.date]
      : [];
  });

  if (dates.length === 0) {
    return null;
  }

  return new Date(Math.min(...dates) * 1_000).toISOString().slice(0, 10);
}

function readCoverImageId(value: unknown): string | null {
  if (!isRecord(value) || typeof value.image_id !== "string") {
    return null;
  }

  const imageId = value.image_id.trim();

  return imageId === "" ? null : imageId;
}

function parseGames(value: unknown): readonly IgdbGame[] {
  if (!Array.isArray(value)) {
    throw new HttpError(
      502,
      "invalid_igdb_response",
      "IGDB returned an unexpected response.",
    );
  }

  return value.map((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.id !== "number" ||
      !Number.isSafeInteger(entry.id) ||
      typeof entry.name !== "string" ||
      entry.name.trim() === ""
    ) {
      throw new HttpError(
        502,
        "invalid_igdb_response",
        "IGDB returned malformed game data.",
      );
    }

    return {
      externalId: String(entry.id),
      title: entry.name.trim(),
      summary:
        typeof entry.summary === "string" && entry.summary.trim() !== ""
          ? entry.summary.trim()
          : null,
      platforms: readPlatforms(entry.platforms),
      releaseDate: readReleaseDate(entry.release_dates),
      coverImageId: readCoverImageId(entry.cover),
      isDlc: readPlatformId(entry.parent_game) !== null,
      payload: entry,
    };
  });
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new HttpError(
      502,
      "invalid_igdb_response",
      "IGDB returned a response that was not valid JSON.",
    );
  }
}

export class IgdbClient {
  private accessToken: AccessToken | null = null;
  private requestQueue: Promise<void> = Promise.resolve();
  private nextRequestAt = 0;

  constructor(
    private readonly credentials: IgdbCredentials,
    private readonly fetchIgdb: IgdbFetch = fetch,
  ) {}

  async searchGames(
    searchTerm: string,
    includeDlc = false,
  ): Promise<readonly IgdbGame[]> {
    const baseGameQuery = [
      GAME_FIELDS,
      `search ${JSON.stringify(searchTerm)};`,
      "where platforms = (9,48,167) & version_parent = null & parent_game = null;",
      "limit 20;",
    ].join("\n");

    const baseGames = await this.enqueueRequest(baseGameQuery);

    if (!includeDlc) {
      return baseGames;
    }

    const dlcQuery = [
      GAME_FIELDS,
      `search ${JSON.stringify(searchTerm)};`,
      "where platforms = (9,48,167) & version_parent = null & parent_game != null;",
      "limit 10;",
    ].join("\n");

    const dlcGames = await this.enqueueRequest(dlcQuery);

    return [...baseGames, ...dlcGames];
  }

  async getGame(externalId: string): Promise<IgdbGame | null> {
    const query = [
      GAME_FIELDS,
      `where id = ${externalId} & platforms = (9,48,167);`,
      "limit 1;",
    ].join("\n");

    const games = await this.enqueueRequest(query);

    return games[0] ?? null;
  }

  private enqueueRequest(query: string): Promise<readonly IgdbGame[]> {
    const result = this.requestQueue.then(async () => {
      const waitMilliseconds = Math.max(0, this.nextRequestAt - Date.now());

      if (waitMilliseconds > 0) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, waitMilliseconds);
        });
      }

      this.nextRequestAt = Date.now() + MINIMUM_REQUEST_INTERVAL_MS;

      return this.requestGames(query, true);
    });

    this.requestQueue = result.then(
      () => undefined,
      () => undefined,
    );

    return result;
  }

  private async requestGames(
    query: string,
    allowTokenRetry: boolean,
  ): Promise<readonly IgdbGame[]> {
    const accessToken = await this.getAccessToken();

    let response: Response;

    try {
      response = await this.fetchIgdb(IGDB_GAMES_URL, {
        method: "POST",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${accessToken}`,
          "client-id": this.requireCredentials().clientId,
          "content-type": "text/plain",
        },
        body: query,
      });
    } catch {
      throw new HttpError(
        502,
        "igdb_unavailable",
        "IGDB could not be reached.",
      );
    }

    if (response.status === 401 && allowTokenRetry) {
      this.accessToken = null;
      return this.requestGames(query, false);
    }

    if (response.status === 429) {
      throw new HttpError(
        503,
        "igdb_rate_limited",
        "IGDB is temporarily rate limiting requests. Try again shortly.",
      );
    }

    if (!response.ok) {
      throw new HttpError(
        502,
        "igdb_request_failed",
        `IGDB returned HTTP ${response.status}.`,
      );
    }

    return parseGames(await readJson(response));
  }

  private async getAccessToken(): Promise<string> {
    if (
      this.accessToken !== null &&
      this.accessToken.expiresAt - TOKEN_EXPIRY_BUFFER_MS > Date.now()
    ) {
      return this.accessToken.value;
    }

    const credentials = this.requireCredentials();

    const body = new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      grant_type: "client_credentials",
    });

    let response: Response;

    try {
      response = await this.fetchIgdb(TWITCH_TOKEN_URL, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded",
        },
        body,
      });
    } catch {
      throw new HttpError(
        502,
        "igdb_authentication_unavailable",
        "Twitch authentication could not be reached.",
      );
    }

    if (!response.ok) {
      throw new HttpError(
        502,
        "igdb_authentication_failed",
        "Twitch rejected the configured IGDB credentials.",
      );
    }

    const payload = await readJson(response);

    if (
      !isRecord(payload) ||
      typeof payload.access_token !== "string" ||
      payload.access_token.trim() === "" ||
      typeof payload.expires_in !== "number" ||
      !Number.isSafeInteger(payload.expires_in) ||
      payload.expires_in <= 0
    ) {
      throw new HttpError(
        502,
        "invalid_igdb_authentication_response",
        "Twitch returned an unexpected authentication response.",
      );
    }

    this.accessToken = {
      value: payload.access_token,
      expiresAt: Date.now() + payload.expires_in * 1_000,
    };

    return this.accessToken.value;
  }

  private requireCredentials(): {
    clientId: string;
    clientSecret: string;
  } {
    if (
      this.credentials.clientId === null ||
      this.credentials.clientSecret === null
    ) {
      throw new HttpError(
        503,
        "igdb_not_configured",
        "IGDB credentials have not been configured on the local API.",
      );
    }

    return {
      clientId: this.credentials.clientId,
      clientSecret: this.credentials.clientSecret,
    };
  }
}
