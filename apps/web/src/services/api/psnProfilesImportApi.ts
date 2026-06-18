import type { PsnProfilesUserscriptExportPayload } from "../../features/psnProfilesImport/types/psnProfilesImport";
import { apiGet } from "./apiClient";

export interface LatestPsnProfilesImportResponse {
  hasExport: boolean;
  savedAt?: string;
  ageMs?: number;
  payload?: PsnProfilesUserscriptExportPayload;
}

export function getLatestPsnProfilesImport(): Promise<LatestPsnProfilesImportResponse> {
  return apiGet<LatestPsnProfilesImportResponse>("/api/psnprofiles-import/latest");
}
