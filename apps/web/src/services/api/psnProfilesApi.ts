import { apiGet } from "./apiClient";

export interface PsnProfilesIntegrationStatus {
  provider: "psnprofiles";
  enabled: boolean;
  baseUrl: string;
  message: string;
}

export interface PsnProfilesProfileSummary {
  psnId: string;
  profileUrl: string;
  fetchedAt: string;
  pageTitle?: string;
}

export interface PsnProfilesProfileSummaryResponse {
  ok: boolean;
  profile: PsnProfilesProfileSummary;
}

export function getPsnProfilesIntegrationStatus(): Promise<PsnProfilesIntegrationStatus> {
  return apiGet<PsnProfilesIntegrationStatus>("/api/psnprofiles/status");
}

export function getPsnProfilesProfileSummary(psnId: string): Promise<PsnProfilesProfileSummaryResponse> {
  return apiGet<PsnProfilesProfileSummaryResponse>(`/api/psnprofiles/profile/${encodeURIComponent(psnId)}`);
}
