import { HttpError } from "../../errors/httpError.js";
import type {
  AppSettings,
  UpdateAppSettingsInput,
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

const settingKeys = new Set([
  "trophySyncCooldownEnabled",
  "trophySyncCooldownSeconds",
  "notificationDurationSeconds",
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

  return input;
}
