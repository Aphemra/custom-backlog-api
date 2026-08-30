import { homedir } from "node:os";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readPlayStationCredentials } from "../features/playstation/playStationConfig.js";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3001;
const DEFAULT_WEB_DIRECTORY = "../web/dist";
const APPLICATION_DIRECTORY_NAME = "TrophyBacklog";

const apiDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function readPort(rawPort: string | undefined): number {
  if (rawPort === undefined || rawPort.trim() === "") {
    return DEFAULT_PORT;
  }

  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("BACKLOG_PORT must be a whole number between 1 and 65535.");
  }

  return port;
}

function readHost(rawHost: string | undefined): string {
  const host = rawHost?.trim() || DEFAULT_HOST;

  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(
      "BACKLOG_HOST must remain local-only: use 127.0.0.1 or localhost.",
    );
  }

  return host;
}

function readDefaultDataDirectory(): string {
  if (process.platform === "win32") {
    const localAppData =
      process.env.LOCALAPPDATA?.trim() ||
      resolve(homedir(), "AppData", "Local");

    return resolve(localAppData, APPLICATION_DIRECTORY_NAME);
  }

  if (process.platform === "darwin") {
    return resolve(
      homedir(),
      "Library",
      "Application Support",
      APPLICATION_DIRECTORY_NAME,
    );
  }

  const xdgDataDirectory = process.env.XDG_DATA_HOME?.trim();

  return xdgDataDirectory === undefined || xdgDataDirectory === ""
    ? resolve(homedir(), ".local", "share", "trophy-backlog")
    : resolve(xdgDataDirectory, "trophy-backlog");
}

function readDataDirectory(rawDirectory: string | undefined): string {
  const configuredDirectory = rawDirectory?.trim();

  if (configuredDirectory === undefined || configuredDirectory === "") {
    return readDefaultDataDirectory();
  }

  return isAbsolute(configuredDirectory)
    ? configuredDirectory
    : resolve(apiDirectory, configuredDirectory);
}

function readWebDirectory(rawDirectory: string | undefined): string {
  const configuredDirectory = rawDirectory?.trim() || DEFAULT_WEB_DIRECTORY;

  return isAbsolute(configuredDirectory)
    ? configuredDirectory
    : resolve(apiDirectory, configuredDirectory);
}

function readOptionalCredential(value: string | undefined): string | null {
  const credential = value?.trim();

  return credential === undefined || credential === "" ? null : credential;
}

const dataDirectory = readDataDirectory(process.env.BACKLOG_DATA_DIRECTORY);
const webDirectory = readWebDirectory(process.env.BACKLOG_WEB_DIRECTORY);
const playStationCredentials = readPlayStationCredentials(process.env);

export const runtimeConfig = Object.freeze({
  host: readHost(process.env.BACKLOG_HOST),
  port: readPort(process.env.BACKLOG_PORT),
  dataDirectory,
  webDirectory,
  databasePath: resolve(dataDirectory, "trophy-backlog.sqlite"),
  backupDirectory: resolve(dataDirectory, "backups"),
  imageCacheDirectory: resolve(dataDirectory, "images"),
  logDirectory: resolve(dataDirectory, "logs"),
  credentialKeyPath: resolve(dataDirectory, "credentials.key"),
  igdbClientId: readOptionalCredential(process.env.IGDB_CLIENT_ID),
  igdbClientSecret: readOptionalCredential(process.env.IGDB_CLIENT_SECRET),
  playStationCredentials,
});
