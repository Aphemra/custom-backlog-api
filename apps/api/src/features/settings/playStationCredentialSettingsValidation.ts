import { HttpError } from "../../errors/httpError.js";
import type {
  StoredPlayStationCredentialSettings,
  UpdatePlayStationCredentialSettingsInput,
} from "./playStationCredentialSettingsTypes.js";

const MINIMUM_ONLINE_ID_LENGTH = 3;
const MAXIMUM_ONLINE_ID_LENGTH = 16;
const NPSSO_LENGTH = 64;
const MINIMUM_REMINDER_DAYS = 1;
const MAXIMUM_REMINDER_DAYS = 30;

function requireRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(
      400,
      "invalid_playstation_settings",
      "PlayStation settings must be a JSON object.",
    );
  }

  return value as Record<string, unknown>;
}

function rejectUnknownKeys(record: Record<string, unknown>): void {
  const allowedKeys = new Set([
    "readerOnlineId",
    "targetOnlineId",
    "readerNpsso",
    "renewalReminderDays",
  ]);

  const unknownKeys = Object.keys(record).filter(
    (key) => !allowedKeys.has(key),
  );

  if (unknownKeys.length > 0) {
    throw new HttpError(
      400,
      "unknown_playstation_settings",
      `Unknown PlayStation setting${
        unknownKeys.length === 1 ? "" : "s"
      }: ${unknownKeys.join(", ")}.`,
    );
  }
}

function readOnlineId(value: unknown, field: string): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(
      400,
      "invalid_playstation_online_id",
      `${field} must be a string or null.`,
    );
  }

  const onlineId = value.trim();

  if (
    onlineId.length < MINIMUM_ONLINE_ID_LENGTH ||
    onlineId.length > MAXIMUM_ONLINE_ID_LENGTH ||
    !/^[a-zA-Z0-9_-]+$/.test(onlineId)
  ) {
    throw new HttpError(
      400,
      "invalid_playstation_online_id",
      `${field} must contain 3–16 letters, numbers, underscores, or hyphens.`,
    );
  }

  return onlineId;
}

function readNpsso(value: unknown): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(
      400,
      "invalid_playstation_npsso",
      "readerNpsso must be a string or null.",
    );
  }

  const npsso = value.trim();

  if (npsso.length !== NPSSO_LENGTH) {
    throw new HttpError(
      400,
      "invalid_playstation_npsso",
      `readerNpsso must contain exactly ${NPSSO_LENGTH} characters.`,
    );
  }

  return npsso;
}

function readReminderDays(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < MINIMUM_REMINDER_DAYS ||
    value > MAXIMUM_REMINDER_DAYS
  ) {
    throw new HttpError(
      400,
      "invalid_npsso_reminder_days",
      `renewalReminderDays must be an integer between ${MINIMUM_REMINDER_DAYS} and ${MAXIMUM_REMINDER_DAYS}.`,
    );
  }

  return value;
}

export function parseUpdatePlayStationCredentialSettingsInput(
  value: unknown,
): UpdatePlayStationCredentialSettingsInput {
  const record = requireRecord(value);

  rejectUnknownKeys(record);

  if (Object.keys(record).length === 0) {
    throw new HttpError(
      400,
      "empty_playstation_settings_update",
      "Provide at least one PlayStation setting to update.",
    );
  }

  const input: {
    readerOnlineId?: string | null;
    targetOnlineId?: string | null;
    readerNpsso?: string | null;
    renewalReminderDays?: number;
  } = {};

  if (Object.hasOwn(record, "readerOnlineId")) {
    input.readerOnlineId = readOnlineId(
      record.readerOnlineId,
      "readerOnlineId",
    );
  }

  if (Object.hasOwn(record, "targetOnlineId")) {
    input.targetOnlineId = readOnlineId(
      record.targetOnlineId,
      "targetOnlineId",
    );
  }

  if (Object.hasOwn(record, "readerNpsso")) {
    input.readerNpsso = readNpsso(record.readerNpsso);
  }

  if (Object.hasOwn(record, "renewalReminderDays")) {
    input.renewalReminderDays = readReminderDays(record.renewalReminderDays);
  }

  return input;
}

export function requireDistinctPlayStationAccounts(
  current: StoredPlayStationCredentialSettings,
  input: UpdatePlayStationCredentialSettingsInput,
): void {
  const readerOnlineId = Object.hasOwn(input, "readerOnlineId")
    ? (input.readerOnlineId ?? null)
    : current.readerOnlineId;

  const targetOnlineId = Object.hasOwn(input, "targetOnlineId")
    ? (input.targetOnlineId ?? null)
    : current.targetOnlineId;

  if (
    readerOnlineId !== null &&
    targetOnlineId !== null &&
    readerOnlineId.localeCompare(targetOnlineId, undefined, {
      sensitivity: "accent",
    }) === 0
  ) {
    throw new HttpError(
      400,
      "playstation_reader_is_target",
      "The reader and target PlayStation accounts must be different.",
    );
  }
}
