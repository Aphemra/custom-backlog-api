import { HttpError } from "../../errors/httpError.js";
import {
  playStationPlatforms,
  playStatuses,
  type CreateLibraryGameInput,
  type PlayStationPlatform,
  type PlayStatus,
  type UpdateLibraryGameInput,
} from "./libraryGameTypes.js";

const MAX_TITLE_LENGTH = 200;
const MAX_NOTES_LENGTH = 10_000;

function requireRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(
      400,
      "invalid_request_body",
      "The request body must be a JSON object.",
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
      "unknown_fields",
      `Unknown field${unknownKeys.length === 1 ? "" : "s"}: ${unknownKeys.join(", ")}.`,
    );
  }
}

function readRequiredTitle(value: unknown): string {
  if (typeof value !== "string") {
    throw new HttpError(400, "invalid_title", "title must be a string.");
  }

  const title = value.trim();

  if (title.length === 0 || title.length > MAX_TITLE_LENGTH) {
    throw new HttpError(
      400,
      "invalid_title",
      `title must contain between 1 and ${MAX_TITLE_LENGTH} characters.`,
    );
  }

  return title;
}

function readPlatform(value: unknown): PlayStationPlatform {
  if (!playStationPlatforms.includes(value as PlayStationPlatform)) {
    throw new HttpError(
      400,
      "invalid_platform",
      "platform must be PS3, PS4, or PS5.",
    );
  }

  return value as PlayStationPlatform;
}

function readPlayStatus(value: unknown): PlayStatus {
  if (!playStatuses.includes(value as PlayStatus)) {
    throw new HttpError(
      400,
      "invalid_play_status",
      `playStatus must be one of: ${playStatuses.join(", ")}.`,
    );
  }

  return value as PlayStatus;
}

function readBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new HttpError(
      400,
      `invalid_${field}`,
      `${field} must be true or false.`,
    );
  }

  return value;
}

function readNotes(value: unknown): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(
      400,
      "invalid_notes",
      "notes must be a string or null.",
    );
  }

  const notes = value.trim();

  if (notes.length > MAX_NOTES_LENGTH) {
    throw new HttpError(
      400,
      "invalid_notes",
      `notes cannot exceed ${MAX_NOTES_LENGTH} characters.`,
    );
  }

  return notes.length === 0 ? null : notes;
}

export function parseCreateLibraryGameInput(
  value: unknown,
): CreateLibraryGameInput {
  const record = requireRecord(value);

  rejectUnknownKeys(
    record,
    new Set(["title", "platform", "playStatus", "isUnobtainable", "notes"]),
  );

  const input: {
    title: string;
    platform: PlayStationPlatform;
    playStatus?: PlayStatus;
    isUnobtainable?: boolean;
    notes?: string | null;
  } = {
    title: readRequiredTitle(record.title),
    platform: readPlatform(record.platform),
  };

  if (record.playStatus !== undefined) {
    input.playStatus = readPlayStatus(record.playStatus);
  }

  if (record.isUnobtainable !== undefined) {
    input.isUnobtainable = readBoolean(record.isUnobtainable, "isUnobtainable");
  }

  if (record.notes !== undefined) {
    input.notes = readNotes(record.notes);
  }

  return input;
}

export function parseUpdateLibraryGameInput(
  value: unknown,
): UpdateLibraryGameInput {
  const record = requireRecord(value);

  rejectUnknownKeys(
    record,
    new Set(["title", "platform", "playStatus", "isUnobtainable", "notes"]),
  );

  if (Object.keys(record).length === 0) {
    throw new HttpError(
      400,
      "empty_update",
      "Provide at least one field to update.",
    );
  }

  const input: {
    title?: string;
    platform?: PlayStationPlatform;
    playStatus?: PlayStatus;
    isUnobtainable?: boolean;
    notes?: string | null;
  } = {};

  if (record.title !== undefined) {
    input.title = readRequiredTitle(record.title);
  }

  if (record.platform !== undefined) {
    input.platform = readPlatform(record.platform);
  }

  if (record.playStatus !== undefined) {
    input.playStatus = readPlayStatus(record.playStatus);
  }

  if (record.isUnobtainable !== undefined) {
    input.isUnobtainable = readBoolean(record.isUnobtainable, "isUnobtainable");
  }

  if (Object.hasOwn(record, "notes")) {
    input.notes = readNotes(record.notes);
  }

  return input;
}

export function parseLibraryGameOrder(value: unknown): readonly string[] {
  const record = requireRecord(value);

  rejectUnknownKeys(record, new Set(["orderedGameIds"]));

  if (!Array.isArray(record.orderedGameIds)) {
    throw new HttpError(
      400,
      "invalid_game_order",
      "orderedGameIds must be an array of game IDs.",
    );
  }

  const gameIds = record.orderedGameIds.map((gameId) => {
    if (typeof gameId !== "string" || gameId.trim().length === 0) {
      throw new HttpError(
        400,
        "invalid_game_order",
        "Every orderedGameIds entry must be a non-empty string.",
      );
    }

    return gameId.trim();
  });

  if (new Set(gameIds).size !== gameIds.length) {
    throw new HttpError(
      400,
      "duplicate_game_ids",
      "orderedGameIds cannot contain duplicate IDs.",
    );
  }

  return gameIds;
}
