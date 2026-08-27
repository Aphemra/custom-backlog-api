import type { DatabaseSync } from "node:sqlite";
import { Router } from "express";
import { HttpError } from "../errors/httpError.js";
import {
  playStationApiOperations,
  type PlayStationApiOperations,
} from "../features/playstation/playStationApi.js";
import { ImageCacheRepository } from "../features/imageCache/imageCacheRepository.js";
import {
  ImageCacheService,
  type ImageFetch,
} from "../features/imageCache/imageCacheService.js";
import { PlayStationTitleImageService } from "../features/playstation/playStationTitleImageService.js";
import { PlayStationAuthorizationSession } from "../features/playstation/playStationAuthorizationSession.js";
import { PlayStationConnectionService } from "../features/playstation/playStationConnectionService.js";
import { PlayStationLinkedTitleSelector } from "../features/playstation/playStationLinkedTitleSelector.js";
import { PlayStationRequestGate } from "../features/playstation/playStationRequestGate.js";
import { PlayStationTitlePreviewService } from "../features/playstation/playStationTitlePreviewService.js";
import { PlayStationTitleReconciliationService } from "../features/playstation/playStationTitleReconciliationService.js";
import { PlayStationTitleLinkService } from "../features/playstation/playStationTitleLinkService.js";
import type { PlayStationCredentials } from "../features/playstation/playStationTypes.js";
import {
  playStationPlatforms,
  playStatuses,
  type PlayStationPlatform,
  type PlayStatus,
} from "../features/library/libraryGameTypes.js";
import { PlayStationSyncCooldownService } from "../features/playstation/playStationSyncCooldownService.js";
import { PlayStationSyncExecutionLock } from "../features/playstation/playStationSyncExecutionLock.js";
import { PlayStationTrophySyncService } from "../features/playstation/playStationTrophySyncService.js";

export interface PlayStationRouteOptions {
  database: DatabaseSync;
  imageCacheDirectory: string;
  imageFetch?: ImageFetch;
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

  const linkedTitleSelector = new PlayStationLinkedTitleSelector(
    options.database,
  );

  const titleLinkService = new PlayStationTitleLinkService(options.database);

  const imageCacheService = new ImageCacheService(
    new ImageCacheRepository(options.database),
    options.imageCacheDirectory,
    options.imageFetch,
  );

  const titleImageService = new PlayStationTitleImageService(imageCacheService);

  const syncCooldownService = new PlayStationSyncCooldownService(
    options.database,
  );

  const syncExecutionLock = new PlayStationSyncExecutionLock();

  const trophySyncService = new PlayStationTrophySyncService(options.database);

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
      const reconciledPreview = titleReconciliationService.reconcile(
        await titlePreviewService.previewTitles(),
      );

      const preview = titleImageService.attachCachedIcons(reconciledPreview);

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

  routes.post("/title-imports", (request, response, next) => {
    if (request.get("x-trophy-backlog-action") !== "import-playstation-title") {
      response.status(400).json({
        ok: false,
        error: "explicit_playstation_action_required",
        message: "An explicit PlayStation title-import action is required.",
      });

      return;
    }

    try {
      const body: unknown = request.body;

      if (typeof body !== "object" || body === null || Array.isArray(body)) {
        throw new HttpError(
          400,
          "invalid_playstation_title_import",
          "A PlayStation title-import object is required.",
        );
      }

      const fields = body as Record<string, unknown>;

      const allowedFields = new Set([
        "npServiceName",
        "npCommunicationId",
        "platform",
        "playStatus",
      ]);

      if (Object.keys(fields).some((field) => !allowedFields.has(field))) {
        throw new HttpError(
          400,
          "unknown_playstation_title_import_field",
          "The PlayStation title-import request contains an unknown field.",
        );
      }

      if (
        fields.npServiceName !== "trophy" &&
        fields.npServiceName !== "trophy2"
      ) {
        throw new HttpError(
          400,
          "invalid_playstation_title_import",
          "npServiceName must be trophy or trophy2.",
        );
      }

      if (
        typeof fields.npCommunicationId !== "string" ||
        fields.npCommunicationId.trim() === ""
      ) {
        throw new HttpError(
          400,
          "invalid_playstation_title_import",
          "A PlayStation communication ID is required.",
        );
      }

      if (
        typeof fields.platform !== "string" ||
        !playStationPlatforms.includes(fields.platform as PlayStationPlatform)
      ) {
        throw new HttpError(
          400,
          "invalid_platform",
          "platform must be PS3, PS4, or PS5.",
        );
      }

      let playStatus: PlayStatus | undefined;

      if (fields.playStatus !== undefined) {
        if (
          typeof fields.playStatus !== "string" ||
          !playStatuses.includes(fields.playStatus as PlayStatus)
        ) {
          throw new HttpError(
            400,
            "invalid_play_status",
            "playStatus is not supported.",
          );
        }

        playStatus = fields.playStatus as PlayStatus;
      }

      const result = titleLinkService.createAndLinkTitle({
        npServiceName: fields.npServiceName,
        npCommunicationId: fields.npCommunicationId.trim(),
        platform: fields.platform as PlayStationPlatform,
        ...(playStatus === undefined ? {} : { playStatus }),
      });

      response
        .location(`/api/library/games/${result.game.id}`)
        .status(201)
        .json(result);
    } catch (error) {
      next(error);
    }
  });

  routes.post("/progress-syncs", async (request, response, next) => {
    if (
      request.get("x-trophy-backlog-action") !==
      "synchronize-playstation-trophy-progress"
    ) {
      response.status(400).json({
        ok: false,
        error: "explicit_playstation_action_required",
        message:
          "An explicit PlayStation trophy-progress synchronization action is required.",
      });

      return;
    }

    try {
      const result = await syncExecutionLock.run(async () => {
        syncCooldownService.enforceAndRecordAttempt();

        const linkedPreview = linkedTitleSelector.select(
          await titlePreviewService.previewTitles(),
        );

        return {
          synchronization: trophySyncService.synchronize(linkedPreview),
          selection: {
            providerTitleCount: linkedPreview.providerTitleCount,
            supportedTitleCount: linkedPreview.supportedTitleCount,
            excludedTitleCount: linkedPreview.excludedTitleCount,
            linkedTitleCount: linkedPreview.linkedTitleCount,
          },
        };
      });

      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  routes.post("/syncs", async (request, response, next) => {
    if (
      request.get("x-trophy-backlog-action") !==
      "synchronize-playstation-trophies"
    ) {
      response.status(400).json({
        ok: false,
        error: "explicit_playstation_action_required",
        message:
          "An explicit PlayStation trophy-synchronization action is required.",
      });

      return;
    }

    try {
      const result = await syncExecutionLock.run(async () => {
        syncCooldownService.enforceAndRecordAttempt();

        const reconciledPreview = titleReconciliationService.reconcile(
          await titlePreviewService.previewTitles(),
        );

        const preview = titleImageService.attachCachedIcons(reconciledPreview);

        titleLinkService.rememberPreview(preview);

        return {
          synchronization: trophySyncService.synchronize(preview),
          preview,
        };
      });

      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  return routes;
}
