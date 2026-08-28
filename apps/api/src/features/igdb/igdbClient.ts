import { HttpError } from "../../errors/httpError.js";
import type { PlayStationPlatform } from "../library/libraryGameTypes.js";
import type {
  IgdbCompany,
  IgdbCredentials,
  IgdbGame,
  IgdbGameType,
  IgdbImageReference,
  IgdbNamedEntity,
  IgdbRelease,
  IgdbSearchOptions,
  IgdbTimeToBeat,
} from "./igdbTypes.js";

const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const IGDB_GAMES_URL = "https://api.igdb.com/v4/games";
const IGDB_TIME_TO_BEAT_URL = "https://api.igdb.com/v4/game_time_to_beats";
const MINIMUM_REQUEST_INTERVAL_MS = 275;
const TOKEN_EXPIRY_BUFFER_MS = 60_000;
const DLC_GAME_TYPE_IDS = new Set([1, 2, 13, 14]);
const GAME_FIELDS =
  "fields id,name,slug,url,summary,storyline,cover.image_id," +
  "game_type.id,game_type.type,platforms.id," +
  "release_dates.date,release_dates.platform," +
  "genres.id,genres.name,game_modes.id,game_modes.name," +
  "involved_companies.company.id,involved_companies.company.name," +
  "involved_companies.developer,involved_companies.publisher," +
  "collections.id,collections.name,franchises.id,franchises.name," +
  "screenshots.image_id,screenshots.width,screenshots.height," +
  "artworks.image_id,artworks.width,artworks.height," +
  "version_parent,version_title,total_rating,total_rating_count,updated_at;";

const playStationPlatforms = new Map<number, PlayStationPlatform>([
  [9, "PS3"],
  [48, "PS4"],
  [167, "PS5"],
]);

const platformIds: Readonly<Record<PlayStationPlatform, number>> = {
  PS3: 9,
  PS4: 48,
  PS5: 167,
};

function readAddOnTypeIds(
  scope: IgdbSearchOptions["scope"],
): readonly number[] {
  switch (scope) {
    case "dlc":
      return [1];

    case "expansions":
      return [2];

    case "packs":
      return [13];

    case "updates":
      return [14];

    case "all":
      return [1, 2, 13, 14];

    case "games":
    case "editions":
      return [];
  }
}

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

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const result = value.trim();

  return result === "" ? null : result;
}

function readSafeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value)
    ? value
    : null;
}

function readNonNegativeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function readNonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

function readPositiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : null;
}

function readExternalId(value: unknown): string | null {
  const id = readPlatformId(value);

  return id === null ? null : String(id);
}

function readNamedEntities(value: unknown): readonly IgdbNamedEntity[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const entities = value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    const externalId = readExternalId(entry);
    const name = readString(entry.name);

    return externalId === null || name === null ? [] : [{ externalId, name }];
  });

  return [
    ...new Map(entities.map((entity) => [entity.externalId, entity])).values(),
  ];
}

function readImages(value: unknown): readonly IgdbImageReference[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const images = value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    const imageId = readString(entry.image_id);

    return imageId === null
      ? []
      : [
          {
            imageId,
            width: readSafeInteger(entry.width),
            height: readSafeInteger(entry.height),
          },
        ];
  });

  return [...new Map(images.map((image) => [image.imageId, image])).values()];
}

function readCompanies(value: unknown): readonly IgdbCompany[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const companies = value.flatMap((entry) => {
    if (!isRecord(entry) || !isRecord(entry.company)) {
      return [];
    }

    const externalId = readExternalId(entry.company);
    const name = readString(entry.company.name);

    return externalId === null || name === null
      ? []
      : [
          {
            externalId,
            name,
            developer: entry.developer === true,
            publisher: entry.publisher === true,
          },
        ];
  });

  return [
    ...new Map(
      companies.map((company) => [company.externalId, company]),
    ).values(),
  ];
}

function readGameType(value: unknown): IgdbGameType {
  const externalId = readExternalId(value) ?? "0";

  return {
    externalId,
    name: isRecord(value) ? readString(value.type) : null,
  };
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

function readReleases(value: unknown): readonly IgdbRelease[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const releases = value.flatMap((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.date !== "number" ||
      !Number.isSafeInteger(entry.date) ||
      entry.date <= 0
    ) {
      return [];
    }

    const platformId = readPlatformId(entry.platform);
    const platform =
      platformId === null ? undefined : playStationPlatforms.get(platformId);

    return platform === undefined
      ? []
      : [
          {
            platform,
            releaseDate: new Date(entry.date * 1_000)
              .toISOString()
              .slice(0, 10),
          },
        ];
  });

  return [
    ...new Map(
      releases.map((release) => [
        `${release.platform}:${release.releaseDate}`,
        release,
      ]),
    ).values(),
  ];
}

function readCoverImageId(value: unknown): string | null {
  if (!isRecord(value) || typeof value.image_id !== "string") {
    return null;
  }

  const imageId = value.image_id.trim();

  return imageId === "" ? null : imageId;
}

export function parseIgdbGames(value: unknown): readonly IgdbGame[] {
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

    const gameType = readGameType(entry.game_type);

    return {
      externalId: String(entry.id),
      title: entry.name.trim(),
      slug: readString(entry.slug),
      igdbUrl: readString(entry.url),
      summary: readString(entry.summary),
      storyline: readString(entry.storyline),
      platforms: readPlatforms(entry.platforms),
      releaseDate: readReleaseDate(entry.release_dates),
      releases: readReleases(entry.release_dates),
      coverImageId: readCoverImageId(entry.cover),
      screenshots: readImages(entry.screenshots),
      artworks: readImages(entry.artworks),
      genres: readNamedEntities(entry.genres),
      gameModes: readNamedEntities(entry.game_modes),
      companies: readCompanies(entry.involved_companies),
      collections: readNamedEntities(entry.collections),
      franchises: readNamedEntities(entry.franchises),
      gameType,
      parentGameId: readExternalId(entry.version_parent),
      versionTitle: readString(entry.version_title),
      totalRating: readNonNegativeNumber(entry.total_rating),
      totalRatingCount: readNonNegativeInteger(entry.total_rating_count) ?? 0,
      timeToBeat: null,
      providerUpdatedAt:
        readSafeInteger(entry.updated_at) === null
          ? null
          : new Date((entry.updated_at as number) * 1_000).toISOString(),
      isDlc: DLC_GAME_TYPE_IDS.has(Number(gameType.externalId)),
      payload: entry,
    };
  });
}

export function parseIgdbTimeToBeat(value: unknown): IgdbTimeToBeat | null {
  if (!Array.isArray(value)) {
    throw new HttpError(
      502,
      "invalid_igdb_response",
      "IGDB returned an unexpected time-to-beat response.",
    );
  }

  if (value.length === 0) {
    return null;
  }

  const entry = value[0];

  if (!isRecord(entry) || readSafeInteger(entry.game_id) === null) {
    throw new HttpError(
      502,
      "invalid_igdb_response",
      "IGDB returned malformed time-to-beat data.",
    );
  }

  return {
    hastilySeconds: readPositiveInteger(entry.hastily),
    normallySeconds: readPositiveInteger(entry.normally),
    completelySeconds: readPositiveInteger(entry.completely),
    submissionCount: readNonNegativeInteger(entry.count) ?? 0,
  };
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
    options: IgdbSearchOptions,
  ): Promise<readonly IgdbGame[]> {
    const platformFilter =
      options.platform === null
        ? "platforms = (9,48,167)"
        : `platforms = (${platformIds[options.platform]})`;

    const includeEditions =
      options.scope === "editions" || options.scope === "all";

    const baseWhere = includeEditions
      ? `where ${platformFilter} ` + "& game_type != (1,2,5,12,13,14);"
      : `where ${platformFilter} ` +
        "& version_parent = null " +
        "& game_type != (1,2,3,5,12,13,14);";

    const baseGameQuery = [
      GAME_FIELDS,
      `search ${JSON.stringify(searchTerm)};`,
      baseWhere,
      includeEditions ? "limit 40;" : "limit 20;",
    ].join("\n");

    const baseGames = await this.enqueueRequest(() =>
      this.requestGames(baseGameQuery),
    );

    const addOnTypeIds = readAddOnTypeIds(options.scope);

    if (addOnTypeIds.length === 0) {
      return baseGames;
    }

    const addOnQuery = [
      GAME_FIELDS,
      `search ${JSON.stringify(searchTerm)};`,
      `where ${platformFilter} & version_parent = null ` +
        `& game_type = (${addOnTypeIds.join(",")});`,
      "limit 15;",
    ].join("\n");

    const addOnGames = await this.enqueueRequest(() =>
      this.requestGames(addOnQuery),
    );

    return [...baseGames, ...addOnGames];
  }

  async getGame(externalId: string): Promise<IgdbGame | null> {
    const query = [
      GAME_FIELDS,
      `where id = ${externalId} & platforms = (9,48,167);`,
      "limit 1;",
    ].join("\n");

    const games = await this.enqueueRequest(() => this.requestGames(query));

    const game = games[0];

    if (game === undefined) {
      return null;
    }

    const timeToBeatQuery = [
      "fields game_id,hastily,normally,completely,count;",
      `where game_id = ${externalId};`,
      "limit 1;",
    ].join("\n");

    const timeToBeat = await this.enqueueRequest(() =>
      this.requestTimeToBeat(timeToBeatQuery),
    );

    return {
      ...game,
      timeToBeat,
    };
  }

  private enqueueRequest<Result>(
    request: () => Promise<Result>,
  ): Promise<Result> {
    const result = this.requestQueue.then(async () => {
      const waitMilliseconds = Math.max(0, this.nextRequestAt - Date.now());

      if (waitMilliseconds > 0) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, waitMilliseconds);
        });
      }

      this.nextRequestAt = Date.now() + MINIMUM_REQUEST_INTERVAL_MS;

      return request();
    });

    this.requestQueue = result.then(
      () => undefined,
      () => undefined,
    );

    return result;
  }

  private async requestGames(query: string): Promise<readonly IgdbGame[]> {
    return parseIgdbGames(await this.requestEndpoint(IGDB_GAMES_URL, query));
  }

  private async requestTimeToBeat(
    query: string,
  ): Promise<IgdbTimeToBeat | null> {
    return parseIgdbTimeToBeat(
      await this.requestEndpoint(IGDB_TIME_TO_BEAT_URL, query),
    );
  }

  private async requestEndpoint(
    endpoint: string,
    query: string,
    allowTokenRetry = true,
  ): Promise<unknown> {
    const accessToken = await this.getAccessToken();

    let response: Response;

    try {
      response = await this.fetchIgdb(endpoint, {
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
      return this.requestEndpoint(endpoint, query, false);
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

    return readJson(response);
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
