import { randomUUID } from "node:crypto";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type {
  BacklogHistoryActionKind,
  BacklogHistoryActionSource,
  BacklogHistoryDetailValue,
  BacklogHistoryEntry,
  BacklogHistoryListFilters,
  BacklogHistoryListResult,
  CreateBacklogHistoryEntryInput,
} from "./historyTypes.js";
import type { PlayStatus } from "../library/libraryGameTypes.js";

interface BacklogHistoryRow {
  id: string;
  action: BacklogHistoryActionKind;
  source: BacklogHistoryActionSource;
  occurred_at: string;
  game_id: string | null;
  game_title: string | null;
  collection_id: string | null;
  collection_name: string | null;
  previous_play_status: PlayStatus | null;
  next_play_status: PlayStatus | null;
  summary: string;
  details_json: string;
}

interface CountRow {
  count: number;
}

const BACKLOG_HISTORY_SELECT = `
  SELECT
    id,
    action,
    source,
    occurred_at,
    game_id,
    game_title,
    collection_id,
    collection_name,
    previous_play_status,
    next_play_status,
    summary,
    details_json
  FROM backlog_history_entries
`;

const actionsRequiringGame = new Set<BacklogHistoryActionKind>([
  "game_added",
  "game_hidden",
  "game_unhidden",
  "game_deleted",
  "play_status_changed",
  "game_platform_changed",
  "trophy_marked_unobtainable",
  "trophy_restored",
  "collection_membership_changed",
]);

const actionsRequiringCollection = new Set<BacklogHistoryActionKind>([
  "collection_created",
  "collection_updated",
  "collection_deleted",
  "collection_pinned",
  "collection_unpinned",
  "collection_membership_changed",
  "collection_games_reordered",
]);

function normalizeRequiredText(
  value: string,
  name: string,
  maximumLength: number,
): string {
  const normalized = value.trim();

  if (normalized.length === 0 || normalized.length > maximumLength) {
    throw new RangeError(
      `${name} must contain between 1 and ${maximumLength} characters.`,
    );
  }

  return normalized;
}

function normalizeOptionalText(
  value: string | null | undefined,
  name: string,
  maximumLength: number,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  return normalizeRequiredText(value, name, maximumLength);
}

function normalizeOccurredAt(value: string | undefined): string {
  const milliseconds = value === undefined ? Date.now() : Date.parse(value);

  if (!Number.isFinite(milliseconds)) {
    throw new RangeError("occurredAt must be a valid timestamp.");
  }

  return new Date(milliseconds).toISOString();
}

function normalizeDetails(
  details: Readonly<Record<string, BacklogHistoryDetailValue>> | undefined,
): Readonly<Record<string, BacklogHistoryDetailValue>> {
  const normalized = details ?? {};

  for (const [key, value] of Object.entries(normalized)) {
    if (key.trim().length === 0) {
      throw new RangeError("Backlog history detail names cannot be empty.");
    }

    if (
      value !== null &&
      typeof value !== "boolean" &&
      typeof value !== "number" &&
      typeof value !== "string"
    ) {
      throw new RangeError(
        `Backlog history detail ${key} has an unsupported value.`,
      );
    }

    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new RangeError(`Backlog history detail ${key} must be finite.`);
    }
  }

  return normalized;
}

function parseDetails(
  serialized: string,
): Readonly<Record<string, BacklogHistoryDetailValue>> {
  const parsed = JSON.parse(serialized) as unknown;

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Stored backlog history details must be a JSON object.");
  }

  return normalizeDetails(parsed as Record<string, BacklogHistoryDetailValue>);
}

function mapBacklogHistoryEntry(row: BacklogHistoryRow): BacklogHistoryEntry {
  return {
    id: row.id,
    action: row.action,
    source: row.source,
    occurredAt: row.occurred_at,
    gameId: row.game_id,
    gameTitle: row.game_title,
    collectionId: row.collection_id,
    collectionName: row.collection_name,
    previousPlayStatus: row.previous_play_status,
    nextPlayStatus: row.next_play_status,
    summary: row.summary,
    details: parseDetails(row.details_json),
  };
}

function requireEntityPair(
  id: string | null,
  name: string | null,
  entityName: string,
): void {
  if ((id === null) !== (name === null)) {
    throw new RangeError(
      `${entityName} ID and name must either both be provided or both be omitted.`,
    );
  }
}

function validateActionContext(
  input: CreateBacklogHistoryEntryInput,
  gameId: string | null,
  collectionId: string | null,
  previousPlayStatus: PlayStatus | null,
  nextPlayStatus: PlayStatus | null,
): void {
  if (actionsRequiringGame.has(input.action) && gameId === null) {
    throw new RangeError(`${input.action} requires a game snapshot.`);
  }

  if (actionsRequiringCollection.has(input.action) && collectionId === null) {
    throw new RangeError(`${input.action} requires a Collection snapshot.`);
  }

  if (input.action === "play_status_changed") {
    if (
      previousPlayStatus === null ||
      nextPlayStatus === null ||
      previousPlayStatus === nextPlayStatus
    ) {
      throw new RangeError(
        "play_status_changed requires two different Play Status values.",
      );
    }

    return;
  }

  if (previousPlayStatus !== null || nextPlayStatus !== null) {
    throw new RangeError(
      "Play Status snapshots may only be stored for play_status_changed.",
    );
  }
}

function validatePagination(limit: number, offset: number): void {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new RangeError("limit must be between 1 and 100.");
  }

  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new RangeError("offset must be a non-negative integer.");
  }
}

export class BacklogHistoryRepository {
  constructor(private readonly database: DatabaseSync) {}

  append(input: CreateBacklogHistoryEntryInput): BacklogHistoryEntry {
    const id = randomUUID();
    const occurredAt = normalizeOccurredAt(input.occurredAt);
    const gameId = normalizeOptionalText(input.gameId, "gameId", 200);
    const gameTitle = normalizeOptionalText(input.gameTitle, "gameTitle", 300);
    const collectionId = normalizeOptionalText(
      input.collectionId,
      "collectionId",
      200,
    );
    const collectionName = normalizeOptionalText(
      input.collectionName,
      "collectionName",
      200,
    );
    const previousPlayStatus = input.previousPlayStatus ?? null;
    const nextPlayStatus = input.nextPlayStatus ?? null;
    const summary = normalizeRequiredText(input.summary, "summary", 500);
    const details = normalizeDetails(input.details);

    requireEntityPair(gameId, gameTitle, "Game");
    requireEntityPair(collectionId, collectionName, "Collection");

    validateActionContext(
      input,
      gameId,
      collectionId,
      previousPlayStatus,
      nextPlayStatus,
    );

    this.database
      .prepare(
        `
          INSERT INTO backlog_history_entries (
            id,
            action,
            source,
            occurred_at,
            game_id,
            game_title,
            collection_id,
            collection_name,
            previous_play_status,
            next_play_status,
            summary,
            details_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        id,
        input.action,
        input.source,
        occurredAt,
        gameId,
        gameTitle,
        collectionId,
        collectionName,
        previousPlayStatus,
        nextPlayStatus,
        summary,
        JSON.stringify(details),
      );

    return this.requireById(id);
  }

  findById(entryId: string): BacklogHistoryEntry | null {
    const row = this.database
      .prepare(
        `
          ${BACKLOG_HISTORY_SELECT}
          WHERE id = ?
        `,
      )
      .get(entryId) as unknown as BacklogHistoryRow | undefined;

    return row === undefined ? null : mapBacklogHistoryEntry(row);
  }

  list(filters: BacklogHistoryListFilters = {}): BacklogHistoryListResult {
    const conditions: string[] = [];
    const parameters: SQLInputValue[] = [];

    if (filters.action !== undefined) {
      conditions.push("action = ?");
      parameters.push(filters.action);
    }

    if (filters.source !== undefined) {
      conditions.push("source = ?");
      parameters.push(filters.source);
    }

    if (filters.gameId !== undefined) {
      conditions.push("game_id = ?");
      parameters.push(filters.gameId);
    }

    if (filters.collectionId !== undefined) {
      conditions.push("collection_id = ?");
      parameters.push(filters.collectionId);
    }

    if (filters.occurredFrom !== undefined) {
      conditions.push("occurred_at >= ?");
      parameters.push(normalizeOccurredAt(filters.occurredFrom));
    }

    if (filters.occurredTo !== undefined) {
      conditions.push("occurred_at <= ?");
      parameters.push(normalizeOccurredAt(filters.occurredTo));
    }

    const direction = filters.direction ?? "desc";
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    if (direction !== "asc" && direction !== "desc") {
      throw new RangeError("direction must be asc or desc.");
    }

    validatePagination(limit, offset);

    const where =
      conditions.length === 0 ? "" : `WHERE ${conditions.join(" AND ")}`;
    const orderDirection = direction === "asc" ? "ASC" : "DESC";

    const countRow = this.database
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM backlog_history_entries
          ${where}
        `,
      )
      .get(...parameters) as unknown as CountRow;

    const rows = this.database
      .prepare(
        `
          ${BACKLOG_HISTORY_SELECT}
          ${where}
          ORDER BY
            occurred_at ${orderDirection},
            id ${orderDirection}
          LIMIT ? OFFSET ?
        `,
      )
      .all(...parameters, limit, offset) as unknown as BacklogHistoryRow[];

    return {
      entries: rows.map(mapBacklogHistoryEntry),
      totalItems: countRow.count,
    };
  }

  private requireById(entryId: string): BacklogHistoryEntry {
    const entry = this.findById(entryId);

    if (entry === null) {
      throw new Error(
        `Backlog history entry ${entryId} disappeared after insertion.`,
      );
    }

    return entry;
  }
}
