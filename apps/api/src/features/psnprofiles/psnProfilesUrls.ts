import { getPsnProfilesConfig } from "./psnProfilesConfig.js";

export function buildPsnProfilesProfilePath(psnId: string): string {
  return `/${encodeURIComponent(psnId)}`;
}

export function buildPsnProfilesProfileUrl(psnId: string): string {
  const config = getPsnProfilesConfig();

  return `${config.baseUrl}${buildPsnProfilesProfilePath(psnId)}`;
}
