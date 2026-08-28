export interface AppearanceSettings {
  readonly accentColor: string;
  readonly notStartedColor: string;
  readonly playingColor: string;
  readonly onHoldColor: string;
  readonly waitingColor: string;
  readonly completedColor: string;
  readonly unreleasedColor: string;
  readonly unobtainableColor: string;
}

export interface AppSettings extends AppearanceSettings {
  readonly trophySyncCooldownEnabled: boolean;
  readonly trophySyncCooldownSeconds: number;
  readonly notificationDurationSeconds: number;
}

export interface UpdateAppSettingsInput {
  readonly trophySyncCooldownEnabled?: boolean;
  readonly trophySyncCooldownSeconds?: number;
  readonly notificationDurationSeconds?: number;
  readonly accentColor?: string;
  readonly notStartedColor?: string;
  readonly playingColor?: string;
  readonly onHoldColor?: string;
  readonly waitingColor?: string;
  readonly completedColor?: string;
  readonly unreleasedColor?: string;
  readonly unobtainableColor?: string;
}

export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  accentColor: "#8b5cf6",
  notStartedColor: "#8b5cf6",
  playingColor: "#14b8a6",
  onHoldColor: "#64748b",
  waitingColor: "#f59e0b",
  completedColor: "#eab308",
  unreleasedColor: "#3b82f6",
  unobtainableColor: "#ef4444",
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  trophySyncCooldownEnabled: true,
  trophySyncCooldownSeconds: 300,
  notificationDurationSeconds: 5,
  ...DEFAULT_APPEARANCE_SETTINGS,
};
