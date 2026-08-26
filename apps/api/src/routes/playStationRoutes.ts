import { Router } from "express";
import type { PlayStationApiOperations } from "../features/playstation/playStationApi.js";
import { PlayStationConnectionService } from "../features/playstation/playStationConnectionService.js";
import { PlayStationRequestGate } from "../features/playstation/playStationRequestGate.js";
import type { PlayStationCredentials } from "../features/playstation/playStationTypes.js";

export interface PlayStationRouteOptions {
  credentials: PlayStationCredentials;
  operations?: PlayStationApiOperations;
  requestGate?: PlayStationRequestGate;
}

export function createPlayStationRoutes(
  options: PlayStationRouteOptions,
): Router {
  const routes = Router();

  const service = new PlayStationConnectionService(
    options.credentials,
    options.operations,
    options.requestGate,
  );

  routes.get("/status", (_request, response) => {
    response.json({ status: service.getStatus() });
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
      response.json({ connection: await service.testConnection() });
    } catch (error) {
      next(error);
    }
  });

  return routes;
}
