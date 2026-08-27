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
