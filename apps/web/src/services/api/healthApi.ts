import { apiGet } from "./apiClient";

export interface HealthResponse {
  ok: boolean;
}

export function getApiHealth(): Promise<HealthResponse> {
  return apiGet<HealthResponse>("/health");
}
