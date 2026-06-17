import { getIgdbConfigStatus } from "./igdbConfig.js";

export interface IgdbIntegrationStatus {
  provider: "igdb";
  configured: boolean;
  realSearchEnabled: boolean;
  authStrategy: "twitch_client_credentials";
  missingEnvVars: string[];
  message: string;
}

export function getIgdbIntegrationStatus(): IgdbIntegrationStatus {
  const configStatus = getIgdbConfigStatus();

  return {
    provider: "igdb",
    configured: configStatus.configured,
    realSearchEnabled: false,
    authStrategy: "twitch_client_credentials",
    missingEnvVars: configStatus.missingEnvVars,
    message: configStatus.configured
      ? "IGDB client credentials are configured. Real IGDB search is not enabled yet."
      : "IGDB client credentials are not configured. Mock IGDB search is currently active.",
  };
}
