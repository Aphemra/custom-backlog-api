import type { DatabaseSync } from "node:sqlite";
import { Router } from "express";
import {
  playStationApiOperations,
  type PlayStationApiOperations,
} from "../features/playstation/playStationApi.js";
import { PlayStationAuthorizationSession } from "../features/playstation/playStationAuthorizationSession.js";
import { PlayStationConnectionService } from "../features/playstation/playStationConnectionService.js";
import { PlayStationRequestGate } from "../features/playstation/playStationRequestGate.js";
import { PlayStationTitlePreviewService } from "../features/playstation/playStationTitlePreviewService.js";
import { PlayStationTitleReconciliationService } from "../features/playstation/playStationTitleReconciliationService.js";
import type { PlayStationCredentials } from "../features/playstation/playStationTypes.js";

export interface PlayStationRouteOptions {
  database: DatabaseSync;
  credentials: PlayStationCredentials;
  operations?: PlayStationApiOperations;
  requestGate?: PlayStationRequestGate;
}

export function createPlayStationRoutes(
  options: PlayStationRouteOptions,
): Router {
  const routes = Router();

  const operations = options.operations ?? playStationApiOperations;
  const requestGate = options.requestGate ?? new PlayStationRequestGate();

  const authorizationSession = new PlayStationAuthorizationSession(
    options.credentials.readerNpsso,
    operations,
    requestGate,
  );

  const connectionService = new PlayStationConnectionService(
    options.credentials,
    operations,
    requestGate,
    authorizationSession,
  );

  const titlePreviewService = new PlayStationTitlePreviewService(
    connectionService,
    authorizationSession,
    operations,
    requestGate,
  );

  const titleReconciliationService = new PlayStationTitleReconciliationService(
    options.database,
  );

  routes.get("/status", (_request, response) => {
    response.json({ status: connectionService.getStatus() });
  });

  routes.post("/connection-tests", async (request, response, next) => {
    if (
      request.get("x-trophy-backlog-action") !== "test-playstation-connection"
    ) {
      response.status(400).json({
        ok: false,
        error: "explicit_playstation_action_required",
        message: "An explicit PlayStation connection-test action is required.",
      });

      return;
    }

    try {
      response.json({
        connection: await connectionService.testConnection(),
      });
    } catch (error) {
      next(error);
    }
  });

  routes.post("/title-previews", async (request, response, next) => {
    if (
      request.get("x-trophy-backlog-action") !== "preview-playstation-titles"
    ) {
      response.status(400).json({
        ok: false,
        error: "explicit_playstation_action_required",
        message: "An explicit PlayStation title-preview action is required.",
      });

      return;
    }

    try {
      const preview = await titlePreviewService.previewTitles();

      response.json({
        preview: titleReconciliationService.reconcile(preview),
      });
    } catch (error) {
      next(error);
    }
  });

  return routes;
}
