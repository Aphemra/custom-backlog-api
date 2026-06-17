import { getIgdbConfigStatus, getIgdbSearchMode, type IgdbSearchMode } from "./igdbConfig.js";

export interface IgdbIntegrationStatus {
  provider: "igdb";
  configured: boolean;
  searchMode: IgdbSearchMode;
  realSearchEnabled: boolean;
  authStrategy: "twitch_client_credentials";
  missingEnvVars: string[];
  message: string;
}

export function getIgdbIntegrationStatus(): IgdbIntegrationStatus {
  const configStatus = getIgdbConfigStatus();
  const searchMode = getIgdbSearchMode();
  const realSearchEnabled = searchMode === "real" && configStatus.configured;

  return {
    provider: "igdb",
    configured: configStatus.configured,
    searchMode,
    realSearchEnabled,
    authStrategy: "twitch_client_credentials",
    missingEnvVars: configStatus.missingEnvVars,
    message: getStatusMessage({
      configured: configStatus.configured,
      searchMode,
      realSearchEnabled,
    }),
  };
}

function getStatusMessage({
  configured,
  searchMode,
  realSearchEnabled,
}: {
  configured: boolean;
  searchMode: IgdbSearchMode;
  realSearchEnabled: boolean;
}): string {
  if (realSearchEnabled) {
    return "Real IGDB search is enabled.";
  }

  if (searchMode === "real" && !configured) {
    return "Real IGDB search was requested, but IGDB client credentials are missing.";
  }

  if (configured) {
    return "IGDB client credentials are configured. Mock IGDB search is currently active.";
  }

  return "IGDB client credentials are not configured. Mock IGDB search is currently active.";
}
