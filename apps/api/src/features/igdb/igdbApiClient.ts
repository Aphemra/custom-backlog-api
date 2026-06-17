import { getIgdbAccessToken } from "./igdbAccessTokenService.js";
import { getIgdbConfig } from "./igdbConfig.js";

const IGDB_API_BASE_URL = "https://api.igdb.com/v4";

export class IgdbApiError extends Error {
  status: number;
  responseText: string;

  constructor(message: string, status: number, responseText: string) {
    super(message);

    this.name = "IgdbApiError";
    this.status = status;
    this.responseText = responseText;
  }
}

export async function igdbPost<TResponse>(endpoint: string, queryBody: string): Promise<TResponse> {
  const config = getIgdbConfig();
  const accessToken = await getIgdbAccessToken();

  const response = await fetch(buildIgdbUrl(endpoint), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "text/plain",
      "Client-ID": config.clientId,
      Authorization: `Bearer ${accessToken}`,
    },
    body: queryBody,
  });

  if (!response.ok) {
    const responseText = await response.text();

    throw new IgdbApiError(`IGDB request failed with status ${response.status}.`, response.status, responseText);
  }

  return response.json() as Promise<TResponse>;
}

function buildIgdbUrl(endpoint: string): string {
  const normalizedEndpoint = endpoint.replace(/^\/+/, "");

  return `${IGDB_API_BASE_URL}/${normalizedEndpoint}`;
}
