export interface AppSettings {
  readonly trophySyncCooldownEnabled: boolean;
  readonly trophySyncCooldownSeconds: number;
  readonly notificationDurationSeconds: number;
}

export interface UpdateAppSettingsInput {
  readonly trophySyncCooldownEnabled?: boolean;
  readonly trophySyncCooldownSeconds?: number;
  readonly notificationDurationSeconds?: number;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  trophySyncCooldownEnabled: true,
  trophySyncCooldownSeconds: 300,
  notificationDurationSeconds: 5,
};
