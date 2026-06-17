import { getIgdbConfig } from "./igdbConfig.js";

interface TwitchTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface CachedIgdbAccessToken {
  accessToken: string;
  expiresAtMs: number;
}

const TOKEN_EXPIRY_BUFFER_MS = 60_000;

let cachedAccessToken: CachedIgdbAccessToken | null = null;

export async function getIgdbAccessToken(): Promise<string> {
  if (cachedAccessToken && isCachedTokenStillUsable(cachedAccessToken)) {
    return cachedAccessToken.accessToken;
  }

  const config = getIgdbConfig();

  const searchParams = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "client_credentials",
  });

  const response = await fetch(`https://id.twitch.tv/oauth2/token?${searchParams.toString()}`, {
    method: "POST",
  });

  if (!response.ok) {
    const responseText = await response.text();

    throw new Error(`Failed to get IGDB access token. Twitch auth returned ${response.status}: ${responseText}`);
  }

  const responseData = (await response.json()) as unknown;
  const tokenResponse = parseTwitchTokenResponse(responseData);

  cachedAccessToken = {
    accessToken: tokenResponse.access_token,
    expiresAtMs: Date.now() + tokenResponse.expires_in * 1000,
  };

  return cachedAccessToken.accessToken;
}

export function getCachedIgdbAccessTokenStatus() {
  return {
    hasCachedToken: cachedAccessToken !== null,
    expiresAt: cachedAccessToken ? new Date(cachedAccessToken.expiresAtMs).toISOString() : null,
  };
}

function isCachedTokenStillUsable(token: CachedIgdbAccessToken): boolean {
  return Date.now() < token.expiresAtMs - TOKEN_EXPIRY_BUFFER_MS;
}

function parseTwitchTokenResponse(data: unknown): TwitchTokenResponse {
  if (!isRecord(data)) {
    throw new Error("Twitch auth response was not a JSON object.");
  }

  if (typeof data.access_token !== "string") {
    throw new Error("Twitch auth response was missing access_token.");
  }

  if (typeof data.expires_in !== "number") {
    throw new Error("Twitch auth response was missing expires_in.");
  }

  if (typeof data.token_type !== "string") {
    throw new Error("Twitch auth response was missing token_type.");
  }

  return {
    access_token: data.access_token,
    expires_in: data.expires_in,
    token_type: data.token_type,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
