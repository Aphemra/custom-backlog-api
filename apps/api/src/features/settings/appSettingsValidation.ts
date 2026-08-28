import { HttpError } from "../../errors/httpError.js";
import {
  DEFAULT_APP_SETTINGS,
  type AppSettings,
  type UpdateAppSettingsInput,
} from "./appSettingsTypes.js";

export const MINIMUM_SYNC_COOLDOWN_SECONDS = 1;
export const MAXIMUM_SYNC_COOLDOWN_SECONDS = 86_400;
export const MINIMUM_NOTIFICATION_DURATION_SECONDS = 1;
export const MAXIMUM_NOTIFICATION_DURATION_SECONDS = 60;

function requireRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(
      400,
      "invalid_settings",
      "Settings must be a JSON object.",
    );
  }

  return value as Record<string, unknown>;
}

function rejectUnknownKeys(
  record: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
): void {
  const unknownKeys = Object.keys(record).filter(
    (key) => !allowedKeys.has(key),
  );

  if (unknownKeys.length > 0) {
    throw new HttpError(
      400,
      "unknown_settings",
      `Unknown setting${unknownKeys.length === 1 ? "" : "s"}: ${unknownKeys.join(", ")}.`,
    );
  }
}

function readBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new HttpError(
      400,
      "invalid_setting",
      `${field} must be true or false.`,
    );
  }

  return value;
}

function readInteger(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new HttpError(
      400,
      "invalid_setting",
      `${field} must be an integer between ${minimum} and ${maximum}.`,
    );
  }

  return value;
}

function readHexColor(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    throw new HttpError(
      400,
      "invalid_setting",
      `${field} must be a six-digit hexadecimal color.`,
    );
  }

  return value.toLowerCase();
}

function readStoredHexColor(
  value: unknown,
  field: string,
  fallback: string,
): string {
  return value === undefined ? fallback : readHexColor(value, field);
}

const settingKeys = new Set([
  "trophySyncCooldownEnabled",
  "trophySyncCooldownSeconds",
  "notificationDurationSeconds",
  "accentColor",
  "notStartedColor",
  "playingColor",
  "onHoldColor",
  "waitingColor",
  "completedColor",
  "unreleasedColor",
  "unobtainableColor",
]);

export function parseStoredAppSettings(value: unknown): AppSettings {
  const record = requireRecord(value);

  rejectUnknownKeys(record, settingKeys);

  return {
    trophySyncCooldownEnabled: readBoolean(
      record.trophySyncCooldownEnabled,
      "trophySyncCooldownEnabled",
    ),
    trophySyncCooldownSeconds: readInteger(
      record.trophySyncCooldownSeconds,
      "trophySyncCooldownSeconds",
      MINIMUM_SYNC_COOLDOWN_SECONDS,
      MAXIMUM_SYNC_COOLDOWN_SECONDS,
    ),
    notificationDurationSeconds: readInteger(
      record.notificationDurationSeconds,
      "notificationDurationSeconds",
      MINIMUM_NOTIFICATION_DURATION_SECONDS,
      MAXIMUM_NOTIFICATION_DURATION_SECONDS,
    ),
    accentColor: readStoredHexColor(
      record.accentColor,
      "accentColor",
      DEFAULT_APP_SETTINGS.accentColor,
    ),
    notStartedColor: readStoredHexColor(
      record.notStartedColor,
      "notStartedColor",
      DEFAULT_APP_SETTINGS.notStartedColor,
    ),
    playingColor: readStoredHexColor(
      record.playingColor,
      "playingColor",
      DEFAULT_APP_SETTINGS.playingColor,
    ),
    onHoldColor: readStoredHexColor(
      record.onHoldColor,
      "onHoldColor",
      DEFAULT_APP_SETTINGS.onHoldColor,
    ),
    waitingColor: readStoredHexColor(
      record.waitingColor,
      "waitingColor",
      DEFAULT_APP_SETTINGS.waitingColor,
    ),
    completedColor: readStoredHexColor(
      record.completedColor,
      "completedColor",
      DEFAULT_APP_SETTINGS.completedColor,
    ),
    unreleasedColor: readStoredHexColor(
      record.unreleasedColor,
      "unreleasedColor",
      DEFAULT_APP_SETTINGS.unreleasedColor,
    ),
    unobtainableColor: readStoredHexColor(
      record.unobtainableColor,
      "unobtainableColor",
      DEFAULT_APP_SETTINGS.unobtainableColor,
    ),
  };
}

export function parseUpdateAppSettingsInput(
  value: unknown,
): UpdateAppSettingsInput {
  const record = requireRecord(value);

  rejectUnknownKeys(record, settingKeys);

  if (Object.keys(record).length === 0) {
    throw new HttpError(
      400,
      "empty_settings_update",
      "Provide at least one setting to update.",
    );
  }

  const input: {
    trophySyncCooldownEnabled?: boolean;
    trophySyncCooldownSeconds?: number;
    notificationDurationSeconds?: number;
    accentColor?: string;
    notStartedColor?: string;
    playingColor?: string;
    onHoldColor?: string;
    waitingColor?: string;
    completedColor?: string;
    unreleasedColor?: string;
    unobtainableColor?: string;
  } = {};

  if (record.trophySyncCooldownEnabled !== undefined) {
    input.trophySyncCooldownEnabled = readBoolean(
      record.trophySyncCooldownEnabled,
      "trophySyncCooldownEnabled",
    );
  }

  if (record.trophySyncCooldownSeconds !== undefined) {
    input.trophySyncCooldownSeconds = readInteger(
      record.trophySyncCooldownSeconds,
      "trophySyncCooldownSeconds",
      MINIMUM_SYNC_COOLDOWN_SECONDS,
      MAXIMUM_SYNC_COOLDOWN_SECONDS,
    );
  }

  if (record.notificationDurationSeconds !== undefined) {
    input.notificationDurationSeconds = readInteger(
      record.notificationDurationSeconds,
      "notificationDurationSeconds",
      MINIMUM_NOTIFICATION_DURATION_SECONDS,
      MAXIMUM_NOTIFICATION_DURATION_SECONDS,
    );
  }

  const colorFields = [
    "accentColor",
    "notStartedColor",
    "playingColor",
    "onHoldColor",
    "waitingColor",
    "completedColor",
    "unreleasedColor",
    "unobtainableColor",
  ] as const;

  for (const field of colorFields) {
    if (record[field] !== undefined) {
      input[field] = readHexColor(record[field], field);
    }
  }

  return input;
}
