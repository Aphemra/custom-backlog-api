import { HttpError } from "../../errors/httpError.js";
import {
  migratePursuitStatus,
  playStationPlatforms,
  playStatuses,
  pursuitStatuses,
  type PlayStationPlatform,
  type PlayStatus,
  type PursuitStatus,
} from "../library/libraryGameTypes.js";
import {
  hiddenModes,
  savedViewSortFields,
  type CreateSavedViewInput,
  type HiddenMode,
  type SavedViewFilters,
  type SavedViewSort,
  type SavedViewSortField,
  type SortDirection,
  type UpdateSavedViewInput,
} from "./savedViewTypes.js";

const FILTER_KEYS = new Set([
  "search",
  "platforms",
  "playStatuses",
  "hiddenMode",

  // Accepted temporarily for portable-data versions 1 through 3.
  "pursuitStatuses",
  "archiveMode",

  "collectionIds",
  "platinumEarned",
  "is100Percent",
  "needsSync",
  "alertKinds",
  "alertStatus",
]);

function requireRecord(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(
      400,
      "invalid_saved_view",
      `${field} must be a JSON object.`,
    );
  }

  return value as Record<string, unknown>;
}

function rejectUnknownKeys(
  record: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
  field: string,
): void {
  const unknownKeys = Object.keys(record).filter(
    (key) => !allowedKeys.has(key),
  );

  if (unknownKeys.length > 0) {
    throw new HttpError(
      400,
      "unknown_fields",
      `${field} contains unknown field${
        unknownKeys.length === 1 ? "" : "s"
      }: ${unknownKeys.join(", ")}.`,
    );
  }
}

function readName(value: unknown): string {
  if (typeof value !== "string") {
    throw new HttpError(
      400,
      "invalid_saved_view_name",
      "name must be a string.",
    );
  }

  const name = value.trim();

  if (name.length === 0 || name.length > 100) {
    throw new HttpError(
      400,
      "invalid_saved_view_name",
      "name must contain between 1 and 100 characters.",
    );
  }

  return name;
}

function readStringArray<T extends string>(
  value: unknown,
  field: string,
  allowedValues?: readonly T[],
): readonly T[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw new HttpError(
      400,
      "invalid_saved_view_filters",
      `${field} must be a non-empty array containing no more than 100 items.`,
    );
  }

  const items = value.map((item) => {
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new HttpError(
        400,
        "invalid_saved_view_filters",
        `Every ${field} item must be a non-empty string.`,
      );
    }

    const normalizedItem = item.trim() as T;

    if (
      allowedValues !== undefined &&
      !allowedValues.includes(normalizedItem)
    ) {
      throw new HttpError(
        400,
        "invalid_saved_view_filters",
        `${field} contains an unsupported value.`,
      );
    }

    return normalizedItem;
  });

  if (new Set(items).size !== items.length) {
    throw new HttpError(
      400,
      "invalid_saved_view_filters",
      `${field} cannot contain duplicate values.`,
    );
  }

  return items;
}

function readOptionalBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new HttpError(
      400,
      "invalid_saved_view_filters",
      `${field} must be true or false.`,
    );
  }

  return value;
}

export function parseSavedViewFilters(value: unknown): SavedViewFilters {
  const record = requireRecord(value, "filters");

  rejectUnknownKeys(record, FILTER_KEYS, "filters");

  const filters: {
    search?: string;
    platforms?: readonly PlayStationPlatform[];
    playStatuses?: readonly PlayStatus[];
    hiddenMode?: HiddenMode;
    collectionIds?: readonly string[];
    platinumEarned?: boolean;
    is100Percent?: boolean;
    needsSync?: boolean;
    alertKinds?: readonly ("new_trophies" | "completion_lost")[];
    alertStatus?: "unread" | "read" | "resolved" | "dismissed";
  } = {};

  if (
    record.playStatuses !== undefined &&
    record.pursuitStatuses !== undefined
  ) {
    throw new HttpError(
      400,
      "conflicting_saved_view_filters",
      "filters cannot contain both playStatuses and pursuitStatuses.",
    );
  }

  if (record.hiddenMode !== undefined && record.archiveMode !== undefined) {
    throw new HttpError(
      400,
      "conflicting_saved_view_filters",
      "filters cannot contain both hiddenMode and archiveMode.",
    );
  }

  if (record.search !== undefined) {
    if (
      typeof record.search !== "string" ||
      record.search.trim().length > 200
    ) {
      throw new HttpError(
        400,
        "invalid_saved_view_filters",
        "filters.search must be a string containing no more than 200 characters.",
      );
    }

    if (record.search.trim().length > 0) {
      filters.search = record.search.trim();
    }
  }

  if (record.platforms !== undefined) {
    filters.platforms = readStringArray(
      record.platforms,
      "filters.platforms",
      playStationPlatforms,
    );
  }

  if (record.playStatuses !== undefined) {
    filters.playStatuses = readStringArray(
      record.playStatuses,
      "filters.playStatuses",
      playStatuses,
    );
  }

  if (record.pursuitStatuses !== undefined) {
    const legacyStatuses = readStringArray(
      record.pursuitStatuses,
      "filters.pursuitStatuses",
      pursuitStatuses,
    );

    filters.playStatuses = [
      ...new Set(
        legacyStatuses.map((status) =>
          migratePursuitStatus(status as PursuitStatus),
        ),
      ),
    ];
  }

  if (record.hiddenMode !== undefined) {
    if (!hiddenModes.includes(record.hiddenMode as HiddenMode)) {
      throw new HttpError(
        400,
        "invalid_saved_view_filters",
        "filters.hiddenMode must be visible, hidden, or all.",
      );
    }

    filters.hiddenMode = record.hiddenMode as HiddenMode;
  }

  if (record.archiveMode !== undefined) {
    if (
      record.archiveMode !== "active" &&
      record.archiveMode !== "archived" &&
      record.archiveMode !== "all"
    ) {
      throw new HttpError(
        400,
        "invalid_saved_view_filters",
        "filters.archiveMode must be active, archived, or all.",
      );
    }

    filters.hiddenMode =
      record.archiveMode === "archived"
        ? "hidden"
        : record.archiveMode === "all"
          ? "all"
          : "visible";
  }

  if (record.collectionIds !== undefined) {
    filters.collectionIds = readStringArray(
      record.collectionIds,
      "filters.collectionIds",
    );
  }

  if (record.platinumEarned !== undefined) {
    filters.platinumEarned = readOptionalBoolean(
      record.platinumEarned,
      "filters.platinumEarned",
    );
  }

  if (record.is100Percent !== undefined) {
    filters.is100Percent = readOptionalBoolean(
      record.is100Percent,
      "filters.is100Percent",
    );
  }

  if (record.needsSync !== undefined) {
    filters.needsSync = readOptionalBoolean(
      record.needsSync,
      "filters.needsSync",
    );
  }

  if (record.alertKinds !== undefined) {
    filters.alertKinds = readStringArray(
      record.alertKinds,
      "filters.alertKinds",
      ["new_trophies", "completion_lost"],
    );
  }

  if (record.alertStatus !== undefined) {
    const statuses = ["unread", "read", "resolved", "dismissed"] as const;

    if (!statuses.includes(record.alertStatus as (typeof statuses)[number])) {
      throw new HttpError(
        400,
        "invalid_saved_view_filters",
        "filters.alertStatus contains an unsupported status.",
      );
    }

    filters.alertStatus = record.alertStatus as (typeof statuses)[number];
  }

  return filters;
}

export function parseSavedViewSort(value: unknown): SavedViewSort {
  const record = requireRecord(value, "sort");

  rejectUnknownKeys(record, new Set(["field", "direction"]), "sort");

  const field = record.field === "pursuitStatus" ? "playStatus" : record.field;

  if (!savedViewSortFields.includes(field as SavedViewSortField)) {
    throw new HttpError(
      400,
      "invalid_saved_view_sort",
      "sort.field is unsupported.",
    );
  }

  if (record.direction !== "asc" && record.direction !== "desc") {
    throw new HttpError(
      400,
      "invalid_saved_view_sort",
      "sort.direction must be asc or desc.",
    );
  }

  return {
    field: field as SavedViewSortField,
    direction: record.direction as SortDirection,
  };
}

export function parseCreateSavedViewInput(
  value: unknown,
): CreateSavedViewInput {
  const record = requireRecord(value, "request body");

  rejectUnknownKeys(
    record,
    new Set(["name", "filters", "sort"]),
    "request body",
  );

  return {
    name: readName(record.name),
    filters: parseSavedViewFilters(record.filters),
    sort: parseSavedViewSort(record.sort),
  };
}

export function parseUpdateSavedViewInput(
  value: unknown,
): UpdateSavedViewInput {
  const record = requireRecord(value, "request body");

  rejectUnknownKeys(
    record,
    new Set(["name", "filters", "sort"]),
    "request body",
  );

  if (Object.keys(record).length === 0) {
    throw new HttpError(
      400,
      "empty_update",
      "Provide at least one field to update.",
    );
  }

  const input: {
    name?: string;
    filters?: SavedViewFilters;
    sort?: SavedViewSort;
  } = {};

  if (record.name !== undefined) {
    input.name = readName(record.name);
  }

  if (record.filters !== undefined) {
    input.filters = parseSavedViewFilters(record.filters);
  }

  if (record.sort !== undefined) {
    input.sort = parseSavedViewSort(record.sort);
  }

  return input;
}

export function parseSavedViewOrder(value: unknown): readonly string[] {
  const record = requireRecord(value, "request body");

  rejectUnknownKeys(record, new Set(["orderedViewIds"]), "request body");

  return readStringArray(record.orderedViewIds, "orderedViewIds");
}
