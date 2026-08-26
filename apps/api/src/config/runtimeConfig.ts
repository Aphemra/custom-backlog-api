import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3001;
const DEFAULT_DATA_DIRECTORY = "./runtime";

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

function readDataDirectory(rawDirectory: string | undefined): string {
  const configuredDirectory = rawDirectory?.trim() || DEFAULT_DATA_DIRECTORY;

  return isAbsolute(configuredDirectory)
    ? configuredDirectory
    : resolve(apiDirectory, configuredDirectory);
}

const dataDirectory = readDataDirectory(process.env.BACKLOG_DATA_DIRECTORY);

export const runtimeConfig = Object.freeze({
  host: readHost(process.env.BACKLOG_HOST),
  port: readPort(process.env.BACKLOG_PORT),
  dataDirectory,
  databasePath: resolve(dataDirectory, "trophy-backlog.sqlite"),
  backupDirectory: resolve(dataDirectory, "backups"),
  imageCacheDirectory: resolve(dataDirectory, "images"),
});
