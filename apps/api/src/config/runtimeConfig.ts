const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3001;

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

export const runtimeConfig = Object.freeze({
  host: readHost(process.env.BACKLOG_HOST),
  port: readPort(process.env.BACKLOG_PORT),
});
