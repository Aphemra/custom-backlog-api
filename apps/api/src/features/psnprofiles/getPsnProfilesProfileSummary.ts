import { fetchPsnProfilesHtml } from "./psnProfilesHttpClient.js";
import { parsePsnProfilesPageTitle } from "./parsePsnProfilesProfileSummary.js";
import type { PsnProfilesProfileSummary } from "./psnProfilesTypes.js";
import { buildPsnProfilesProfilePath, buildPsnProfilesProfileUrl } from "./psnProfilesUrls.js";

export async function getPsnProfilesProfileSummary(psnId: string): Promise<PsnProfilesProfileSummary> {
  const profilePath = buildPsnProfilesProfilePath(psnId);
  const html = await fetchPsnProfilesHtml(profilePath);
  const pageTitle = parsePsnProfilesPageTitle(html);

  return {
    psnId,
    profileUrl: buildPsnProfilesProfileUrl(psnId),
    fetchedAt: new Date().toISOString(),
    ...(pageTitle !== undefined ? { pageTitle } : {}),
  };
}
