const requiredIgdbEnvVars = ["IGDB_CLIENT_ID", "IGDB_ACCESS_TOKEN"] as const;

export interface IgdbIntegrationStatus {
  provider: "igdb";
  configured: boolean;
  realSearchEnabled: boolean;
  missingEnvVars: string[];
  message: string;
}

export function getIgdbIntegrationStatus(): IgdbIntegrationStatus {
  const missingEnvVars = requiredIgdbEnvVars.filter((envVarName) => !process.env[envVarName]?.trim());

  const configured = missingEnvVars.length === 0;

  return {
    provider: "igdb",
    configured,
    realSearchEnabled: false,
    missingEnvVars,
    message: configured
      ? "IGDB credentials are configured. Real IGDB search is not enabled yet."
      : "IGDB credentials are not configured. Mock IGDB search is currently active.",
  };
}
