import { apiGet } from "./apiClient";

export interface PlatPricesIntegrationStatus {
  provider: "platprices";
  enabled: boolean;
  configured: boolean;
  missingEnvVars: string[];
  baseUrl: string;
  message: string;
}

export function getPlatPricesIntegrationStatus(): Promise<PlatPricesIntegrationStatus> {
  return apiGet<PlatPricesIntegrationStatus>("/api/platprices/status");
}
