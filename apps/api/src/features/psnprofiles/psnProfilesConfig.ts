export interface PsnProfilesConfig {
  enabled: boolean;
  baseUrl: string;
  userAgent: string;
}

export interface PsnProfilesIntegrationStatus {
  provider: "psnprofiles";
  enabled: boolean;
  baseUrl: string;
  message: string;
}

export function getPsnProfilesConfig(): PsnProfilesConfig {
  return {
    enabled: getPsnProfilesEnabled(),
    baseUrl: getPsnProfilesBaseUrl(),
    userAgent: getPsnProfilesUserAgent(),
  };
}

export function getPsnProfilesIntegrationStatus(): PsnProfilesIntegrationStatus {
  const config = getPsnProfilesConfig();

  return {
    provider: "psnprofiles",
    enabled: config.enabled,
    baseUrl: config.baseUrl,
    message: config.enabled ? "PSNProfiles integration is enabled." : "PSNProfiles integration is disabled.",
  };
}

function getPsnProfilesEnabled(): boolean {
  const value = process.env.PSNPROFILES_ENABLED?.trim().toLowerCase();

  return value === "true";
}

function getPsnProfilesBaseUrl(): string {
  return (process.env.PSNPROFILES_BASE_URL?.trim() ?? "https://psnprofiles.com").replace(/\/+$/, "");
}

function getPsnProfilesUserAgent(): string {
  return process.env.PSNPROFILES_USER_AGENT?.trim() ?? "CustomBacklogApp/0.1 local-development";
}
