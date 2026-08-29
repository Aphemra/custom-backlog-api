import type {
  AppSettings,
  PlayStationCredentialSettings,
  UpdateAppSettingsInput,
  UpdatePlayStationCredentialSettingsInput,
} from "../../domain/settings";
import { requestJson } from "./apiClient";

interface SettingsResponse {
  readonly settings: AppSettings;
}

interface PlayStationCredentialSettingsResponse {
  readonly settings: PlayStationCredentialSettings;
}

export const settingsApi = {
  async get(signal?: AbortSignal): Promise<AppSettings> {
    const response = await requestJson<SettingsResponse>("/api/settings", {
      signal,
    });

    return response.settings;
  },

  async update(input: UpdateAppSettingsInput): Promise<AppSettings> {
    const response = await requestJson<SettingsResponse>("/api/settings", {
      method: "PATCH",
      body: JSON.stringify(input),
    });

    return response.settings;
  },

  async getPlayStation(
    signal?: AbortSignal,
  ): Promise<PlayStationCredentialSettings> {
    const response = await requestJson<PlayStationCredentialSettingsResponse>(
      "/api/settings/playstation",
      {
        signal,
      },
    );

    return response.settings;
  },

  async updatePlayStation(
    input: UpdatePlayStationCredentialSettingsInput,
  ): Promise<PlayStationCredentialSettings> {
    const response = await requestJson<PlayStationCredentialSettingsResponse>(
      "/api/settings/playstation",
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );

    return response.settings;
  },
};
