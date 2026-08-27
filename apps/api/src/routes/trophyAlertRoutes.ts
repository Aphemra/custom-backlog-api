import type { DatabaseSync } from "node:sqlite";
import { Router, type Request } from "express";
import { HttpError } from "../errors/httpError.js";
import { TrophyAlertRepository } from "../features/alerts/trophyAlertRepository.js";
import {
  trophyAlertKinds,
  trophyAlertStatuses,
  type TrophyAlertKind,
  type TrophyAlertStatus,
} from "../features/alerts/trophyAlertTypes.js";

function readAlertId(request: Request): string {
  const alertId = request.params.alertId;

  if (typeof alertId !== "string" || alertId.trim().length === 0) {
    throw new HttpError(
      400,
      "invalid_trophy_alert_id",
      "A trophy alert ID is required.",
    );
  }

  return alertId.trim();
}

function readKind(value: unknown): TrophyAlertKind | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value !== "string" ||
    !trophyAlertKinds.includes(value as TrophyAlertKind)
  ) {
    throw new HttpError(
      400,
      "invalid_trophy_alert_kind",
      "kind must be new_trophies or completion_lost.",
    );
  }

  return value as TrophyAlertKind;
}

function readStatus(value: unknown): TrophyAlertStatus | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value !== "string" ||
    !trophyAlertStatuses.includes(value as TrophyAlertStatus)
  ) {
    throw new HttpError(
      400,
      "invalid_trophy_alert_status",
      "status must be unread, read, resolved, or dismissed.",
    );
  }

  return value as TrophyAlertStatus;
}

function readStatusUpdate(value: unknown): TrophyAlertStatus {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(
      400,
      "invalid_trophy_alert_update",
      "The request body must contain a status.",
    );
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);

  if (keys.length !== 1 || keys[0] !== "status") {
    throw new HttpError(
      400,
      "invalid_trophy_alert_update",
      "Only the trophy alert status may be changed.",
    );
  }

  const status = readStatus(record.status);

  if (status === undefined) {
    throw new HttpError(
      400,
      "invalid_trophy_alert_update",
      "A trophy alert status is required.",
    );
  }

  return status;
}

export function createTrophyAlertRoutes(database: DatabaseSync): Router {
  const routes = Router();
  const repository = new TrophyAlertRepository(database);

  routes.get("/", (request, response) => {
    const kind = readKind(request.query.kind);
    const status = readStatus(request.query.status);

    response.json({
      alerts: repository.list({
        ...(kind === undefined ? {} : { kind }),
        ...(status === undefined ? {} : { status }),
      }),
    });
  });

  routes.get("/summary", (_request, response) => {
    response.json({
      counts: repository.count(),
    });
  });

  routes.get("/:alertId", (request, response) => {
    const alert = repository.findById(readAlertId(request));

    if (alert === null) {
      throw new HttpError(
        404,
        "trophy_alert_not_found",
        "The requested trophy alert was not found.",
      );
    }

    response.json({ alert });
  });

  routes.patch("/:alertId", (request, response) => {
    const alert = repository.updateStatus(
      readAlertId(request),
      readStatusUpdate(request.body),
    );

    if (alert === null) {
      throw new HttpError(
        404,
        "trophy_alert_not_found",
        "The requested trophy alert was not found.",
      );
    }

    response.json({ alert });
  });

  return routes;
}
