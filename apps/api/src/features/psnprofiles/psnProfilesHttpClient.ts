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
      Accept: "text/html",
      "User-Agent": config.userAgent,
    },
  });

  if (!response.ok) {
    throw new PsnProfilesHttpError(`PSNProfiles request failed with status ${response.status}.`, response.status);
  }

  return response.text();
}
