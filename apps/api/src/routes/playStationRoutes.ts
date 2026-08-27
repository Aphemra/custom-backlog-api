import type { DatabaseSync } from "node:sqlite";
import { Router } from "express";
import { HttpError } from "../errors/httpError.js";
import {
  playStationApiOperations,
  type PlayStationApiOperations,
} from "../features/playstation/playStationApi.js";
import { PlayStationAuthorizationSession } from "../features/playstation/playStationAuthorizationSession.js";
import { PlayStationConnectionService } from "../features/playstation/playStationConnectionService.js";
import { PlayStationRequestGate } from "../features/playstation/playStationRequestGate.js";
import { PlayStationTitlePreviewService } from "../features/playstation/playStationTitlePreviewService.js";
import { PlayStationTitleReconciliationService } from "../features/playstation/playStationTitleReconciliationService.js";
import { PlayStationTitleLinkService } from "../features/playstation/playStationTitleLinkService.js";
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

  const titleLinkService = new PlayStationTitleLinkService(options.database);

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
      const preview = titleReconciliationService.reconcile(
        await titlePreviewService.previewTitles(),
      );

      titleLinkService.rememberPreview(preview);

      response.json({ preview });
    } catch (error) {
      next(error);
    }
  });

  routes.post("/title-links", (request, response, next) => {
    if (request.get("x-trophy-backlog-action") !== "link-playstation-title") {
      response.status(400).json({
        ok: false,
        error: "explicit_playstation_action_required",
        message: "An explicit PlayStation title-link action is required.",
      });

      return;
    }

    try {
      const body: unknown = request.body;

      if (typeof body !== "object" || body === null || Array.isArray(body)) {
        throw new HttpError(
          400,
          "invalid_playstation_title_link",
          "A PlayStation title-link object is required.",
        );
      }

      const fields = body as Record<string, unknown>;
      const allowedFields = new Set([
        "gameId",
        "npServiceName",
        "npCommunicationId",
      ]);

      if (Object.keys(fields).some((field) => !allowedFields.has(field))) {
        throw new HttpError(
          400,
          "unknown_playstation_title_link_field",
          "The PlayStation title-link request contains an unknown field.",
        );
      }

      if (
        typeof fields.gameId !== "string" ||
        fields.gameId.trim() === "" ||
        (fields.npServiceName !== "trophy" &&
          fields.npServiceName !== "trophy2") ||
        typeof fields.npCommunicationId !== "string" ||
        fields.npCommunicationId.trim() === ""
      ) {
        throw new HttpError(
          400,
          "invalid_playstation_title_link",
          "gameId, npServiceName, and npCommunicationId are required.",
        );
      }

      const link = titleLinkService.linkTitle(
        fields.gameId.trim(),
        fields.npServiceName,
        fields.npCommunicationId.trim(),
      );

      response.status(201).json({ link });
    } catch (error) {
      next(error);
    }
  });

  return routes;
}
