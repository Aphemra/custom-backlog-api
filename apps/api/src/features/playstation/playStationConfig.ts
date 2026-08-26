import type { PlayStationCredentials } from "./playStationTypes.js";

function readOptionalValue(value: string | undefined): string | null {
  const normalized = value?.trim();

  return normalized === undefined || normalized === "" ? null : normalized;
}

function readNpsso(value: string | undefined): string | null {
  const npsso = readOptionalValue(value);

  if (npsso !== null && npsso.length !== 64) {
    throw new Error("PSN_READER_NPSSO must contain exactly 64 characters.");
  }

  return npsso;
}

export function readPlayStationCredentials(
  environment: NodeJS.ProcessEnv,
): PlayStationCredentials {
  const readerOnlineId = readOptionalValue(environment.PSN_READER_ONLINE_ID);
  const targetOnlineId = readOptionalValue(environment.PSN_TARGET_ONLINE_ID);

  if (
    readerOnlineId !== null &&
    targetOnlineId !== null &&
    readerOnlineId.localeCompare(targetOnlineId, undefined, {
      sensitivity: "accent",
    }) === 0
  ) {
    throw new Error(
      "PSN_READER_ONLINE_ID and PSN_TARGET_ONLINE_ID must identify different accounts.",
    );
  }

  return {
    readerNpsso: readNpsso(environment.PSN_READER_NPSSO),
    readerOnlineId,
    targetOnlineId,
  };
}
