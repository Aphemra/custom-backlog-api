import type { PlayStationCredentialSettingsRepository } from "../settings/playStationCredentialSettingsRepository.js";
import type { PlayStationCredentials } from "./playStationTypes.js";

export type PlayStationCredentialSource =
  | PlayStationCredentials
  | (() => PlayStationCredentials);

export class PlayStationCredentialProvider {
  constructor(
    private readonly repository: PlayStationCredentialSettingsRepository,
    private readonly fallbackCredentials: PlayStationCredentials,
  ) {}

  getCredentials(): PlayStationCredentials {
    const local = this.repository.get();

    const hasLocalConfiguration =
      local.readerOnlineId !== null ||
      local.targetOnlineId !== null ||
      local.readerNpsso !== null;

    if (!hasLocalConfiguration) {
      return {
        ...this.fallbackCredentials,
      };
    }

    return {
      readerNpsso: local.readerNpsso,
      readerOnlineId: local.readerOnlineId,
      targetOnlineId: local.targetOnlineId,
    };
  }
}

export function readPlayStationCredentialSource(
  source: PlayStationCredentialSource,
): PlayStationCredentials {
  return typeof source === "function" ? source() : source;
}
