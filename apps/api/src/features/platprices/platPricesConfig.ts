const requiredPlatPricesEnvVars = ["PLATPRICES_API_KEY"] as const;

export interface PlatPricesConfig {
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
}

export interface PlatPricesIntegrationStatus {
  provider: "platprices";
  enabled: boolean;
  configured: boolean;
  missingEnvVars: string[];
  baseUrl: string;
  message: string;
}

export function getPlatPricesConfig(): PlatPricesConfig {
  return {
    enabled: getPlatPricesEnabled(),
    apiKey: process.env.PLATPRICES_API_KEY?.trim() ?? "",
    baseUrl: getPlatPricesBaseUrl(),
  };
}

export function getPlatPricesIntegrationStatus(): PlatPricesIntegrationStatus {
  const config = getPlatPricesConfig();
  const missingEnvVars = getMissingPlatPricesEnvVars();

  const configured = missingEnvVars.length === 0;

  return {
    provider: "platprices",
    enabled: config.enabled,
    configured,
    missingEnvVars,
    baseUrl: config.baseUrl,
    message: getPlatPricesStatusMessage({
      enabled: config.enabled,
      configured,
    }),
  };
}

function getMissingPlatPricesEnvVars(): string[] {
  return requiredPlatPricesEnvVars.filter((envVarName) => !process.env[envVarName]?.trim());
}

function getPlatPricesEnabled(): boolean {
  const value = process.env.PLATPRICES_ENABLED?.trim().toLowerCase();

  return value === "true";
}

function getPlatPricesBaseUrl(): string {
  return (process.env.PLATPRICES_BASE_URL?.trim() ?? "https://platprices.com").replace(/\/+$/, "");
}

function getPlatPricesStatusMessage({ enabled, configured }: { enabled: boolean; configured: boolean }): string {
  if (!enabled) {
    return "PlatPrices integration is disabled.";
  }

  if (!configured) {
    return "PlatPrices integration is enabled but missing configuration.";
  }

  return "PlatPrices integration is enabled and configured.";
}
