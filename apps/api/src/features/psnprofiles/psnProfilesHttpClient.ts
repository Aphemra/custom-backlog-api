import { getPsnProfilesConfig } from "./psnProfilesConfig.js";

export class PsnProfilesHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "PsnProfilesHttpError";
  }
}

export async function fetchPsnProfilesHtml(path: string): Promise<string> {
  const config = getPsnProfilesConfig();

  if (!config.enabled) {
    throw new Error("PSNProfiles integration is disabled.");
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${config.baseUrl}${normalizedPath}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": config.userAgent,
    },
  });

  if (!response.ok) {
    throw new PsnProfilesHttpError(`PSNProfiles request failed with status ${response.status}.`, response.status);
  }

  return response.text();
}
