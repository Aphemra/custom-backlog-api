import type { DatabaseSync } from "node:sqlite";
import { Router, type Request } from "express";
import { HttpError } from "../errors/httpError.js";
import { BacklogHistoryRepository } from "../features/history/backlogHistoryRepository.js";
import {
  playStationPlatforms,
  type PlayStationPlatform,
} from "../features/library/libraryGameTypes.js";
import { TrophyHistoryQueryService } from "../features/history/trophyHistoryQueryService.js";
import { TrophyHistoryRepository } from "../features/history/trophyHistoryRepository.js";
import {
  backlogHistoryActionKinds,
  backlogHistoryActionSources,
  trophyHistoryMilestoneKinds,
  trophyHistorySortDirections,
  type BacklogHistoryActionKind,
  type BacklogHistoryActionSource,
  type BacklogHistoryPageResult,
  type BacklogHistoryQuery,
  type TrophyHistoryLogQuery,
  type TrophyHistoryMilestoneKind,
  type TrophyHistoryMilestoneQuery,
  type TrophyHistorySortDirection,
} from "../features/history/historyTypes.js";
import type { PlayStationTrophyType } from "../features/playstation/playStationTypes.js";

const trophyTypes = ["bronze", "silver", "gold", "platinum"] as const;

function readOptionalString(value: unknown, name: string): string | null {
  if (value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(
      400,
      `invalid_history_${name}`,
      `${name} must be a single string value.`,
    );
  }

  const normalized = value.trim();

  return normalized.length === 0 ? null : normalized;
}

function readPlatform(value: unknown): PlayStationPlatform | null {
  const platform = readOptionalString(value, "platform");

  if (platform === null) {
    return null;
  }

  if (!playStationPlatforms.includes(platform as PlayStationPlatform)) {
    throw new HttpError(
      400,
      "invalid_history_platform",
      "platform must be PS3, PS4, or PS5.",
    );
  }

  return platform as PlayStationPlatform;
}

function readTrophyType(value: unknown): PlayStationTrophyType | null {
  const trophyType = readOptionalString(value, "trophy_type");

  if (trophyType === null) {
    return null;
  }

  if (!trophyTypes.includes(trophyType as PlayStationTrophyType)) {
    throw new HttpError(
      400,
      "invalid_history_trophy_type",
      "trophyType must be bronze, silver, gold, or platinum.",
    );
  }

  return trophyType as PlayStationTrophyType;
}

function readMilestoneKind(value: unknown): TrophyHistoryMilestoneKind | null {
  const kind = readOptionalString(value, "milestone_kind");

  if (kind === null) {
    return null;
  }

  if (
    !trophyHistoryMilestoneKinds.includes(kind as TrophyHistoryMilestoneKind)
  ) {
    throw new HttpError(
      400,
      "invalid_history_milestone_kind",
      "kind must be trophy_total, platinum_total, or trophy_level.",
    );
  }

  return kind as TrophyHistoryMilestoneKind;
}

function readBacklogAction(value: unknown): BacklogHistoryActionKind | null {
  const action = readOptionalString(value, "backlog_action");

  if (action === null) {
    return null;
  }

  if (!backlogHistoryActionKinds.includes(action as BacklogHistoryActionKind)) {
    throw new HttpError(
      400,
      "invalid_history_backlog_action",
      "action is not a supported backlog activity type.",
    );
  }

  return action as BacklogHistoryActionKind;
}

function readBacklogSource(value: unknown): BacklogHistoryActionSource | null {
  const source = readOptionalString(value, "backlog_source");

  if (source === null) {
    return null;
  }

  if (
    !backlogHistoryActionSources.includes(source as BacklogHistoryActionSource)
  ) {
    throw new HttpError(
      400,
      "invalid_history_backlog_source",
      "source is not a supported backlog activity source.",
    );
  }

  return source as BacklogHistoryActionSource;
}

function readDirection(value: unknown): TrophyHistorySortDirection {
  const direction = readOptionalString(value, "direction") ?? "desc";

  if (
    !trophyHistorySortDirections.includes(
      direction as TrophyHistorySortDirection,
    )
  ) {
    throw new HttpError(
      400,
      "invalid_history_direction",
      "direction must be asc or desc.",
    );
  }

  return direction as TrophyHistorySortDirection;
}

function readInteger(
  value: unknown,
  name: string,
  defaultValue: number,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined) {
    return defaultValue;
  }

  if (
    typeof value !== "string" ||
    !/^\d+$/u.test(value) ||
    !Number.isSafeInteger(Number(value))
  ) {
    throw new HttpError(
      400,
      `invalid_history_${name}`,
      `${name} must be a whole number.`,
    );
  }

  const parsed = Number(value);

  if (parsed < minimum || parsed > maximum) {
    throw new HttpError(
      400,
      `invalid_history_${name}`,
      `${name} must be between ${minimum} and ${maximum}.`,
    );
  }

  return parsed;
}

function readDate(value: unknown, name: string): string | null {
  const rawValue = readOptionalString(value, name);

  if (rawValue === null) {
    return null;
  }

  const milliseconds = Date.parse(rawValue);

  if (!Number.isFinite(milliseconds)) {
    throw new HttpError(
      400,
      `invalid_history_${name}`,
      `${name} must be a valid date or timestamp.`,
    );
  }

  return new Date(milliseconds).toISOString();
}

function readTrophyLogQuery(request: Request): TrophyHistoryLogQuery {
  const earnedFrom = readDate(request.query.earnedFrom, "earned_from");
  const earnedTo = readDate(request.query.earnedTo, "earned_to");

  if (
    earnedFrom !== null &&
    earnedTo !== null &&
    Date.parse(earnedFrom) > Date.parse(earnedTo)
  ) {
    throw new HttpError(
      400,
      "invalid_history_date_range",
      "earnedFrom cannot be later than earnedTo.",
    );
  }

  return {
    search: readOptionalString(request.query.search, "search"),
    platform: readPlatform(request.query.platform),
    trophyType: readTrophyType(request.query.trophyType),
    gameId: readOptionalString(request.query.gameId, "game_id"),
    earnedFrom,
    earnedTo,
    direction: readDirection(request.query.direction),
    page: readInteger(request.query.page, "page", 1, 1, 1_000_000),
    pageSize: readInteger(request.query.pageSize, "page_size", 50, 1, 100),
  };
}

function readMilestoneQuery(request: Request): TrophyHistoryMilestoneQuery {
  return {
    kind: readMilestoneKind(request.query.kind),
    direction: readDirection(request.query.direction),
  };
}

function readBacklogQuery(request: Request): BacklogHistoryQuery {
  const occurredFrom = readDate(request.query.occurredFrom, "occurred_from");
  const occurredTo = readDate(request.query.occurredTo, "occurred_to");

  if (
    occurredFrom !== null &&
    occurredTo !== null &&
    Date.parse(occurredFrom) > Date.parse(occurredTo)
  ) {
    throw new HttpError(
      400,
      "invalid_history_backlog_date_range",
      "occurredFrom cannot be later than occurredTo.",
    );
  }

  return {
    action: readBacklogAction(request.query.action),
    source: readBacklogSource(request.query.source),
    gameId: readOptionalString(request.query.gameId, "game_id"),
    collectionId: readOptionalString(
      request.query.collectionId,
      "collection_id",
    ),
    occurredFrom,
    occurredTo,
    direction: readDirection(request.query.direction),
    page: readInteger(request.query.page, "page", 1, 1, 1_000_000),
    pageSize: readInteger(request.query.pageSize, "page_size", 50, 1, 100),
  };
}

export function createHistoryRoutes(database: DatabaseSync): Router {
  const routes = Router();
  const service = new TrophyHistoryQueryService(
    new TrophyHistoryRepository(database),
  );
  const backlogHistory = new BacklogHistoryRepository(database);

  routes.get("/overview", (_request, response) => {
    response.json(service.getOverview());
  });

  routes.get("/statistics", (_request, response) => {
    response.json(service.getStatistics());
  });

  routes.get("/trophies", (request, response) => {
    response.json(service.listTrophies(readTrophyLogQuery(request)));
  });

  routes.get("/milestones", (request, response) => {
    response.json(service.listMilestones(readMilestoneQuery(request)));
  });

  routes.get("/backlog", (request, response) => {
    const query = readBacklogQuery(request);

    const result = backlogHistory.list({
      ...(query.action === null ? {} : { action: query.action }),
      ...(query.source === null ? {} : { source: query.source }),
      ...(query.gameId === null ? {} : { gameId: query.gameId }),
      ...(query.collectionId === null
        ? {}
        : { collectionId: query.collectionId }),
      ...(query.occurredFrom === null
        ? {}
        : { occurredFrom: query.occurredFrom }),
      ...(query.occurredTo === null ? {} : { occurredTo: query.occurredTo }),
      direction: query.direction,
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    });

    const page: BacklogHistoryPageResult = {
      entries: result.entries,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems: result.totalItems,
        totalPages:
          result.totalItems === 0
            ? 0
            : Math.ceil(result.totalItems / query.pageSize),
      },
    };

    response.json(page);
  });

  return routes;
}
