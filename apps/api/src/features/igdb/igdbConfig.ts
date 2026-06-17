const requiredIgdbEnvVars = ["IGDB_CLIENT_ID", "IGDB_CLIENT_SECRET"] as const;

export interface IgdbConfig {
  clientId: string;
  clientSecret: string;
}

export interface IgdbConfigStatus {
  configured: boolean;
  missingEnvVars: string[];
}

export function getIgdbConfigStatus(): IgdbConfigStatus {
  const missingEnvVars = requiredIgdbEnvVars.filter((envVarName) => !process.env[envVarName]?.trim());

  return {
    configured: missingEnvVars.length === 0,
    missingEnvVars,
  };
}

export function getIgdbConfig(): IgdbConfig {
  const status = getIgdbConfigStatus();

  if (!status.configured) {
    throw new Error(`IGDB is not configured. Missing env var(s): ${status.missingEnvVars.join(", ")}`);
  }

  return {
    clientId: process.env.IGDB_CLIENT_ID!.trim(),
    clientSecret: process.env.IGDB_CLIENT_SECRET!.trim(),
  };
}
