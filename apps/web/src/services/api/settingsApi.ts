import type {
  AppSettings,
  UpdateAppSettingsInput,
} from "../../domain/settings";
import { requestJson } from "./apiClient";

interface SettingsResponse {
  readonly settings: AppSettings;
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
};
