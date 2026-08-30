import type { DatabaseSync } from "node:sqlite";
import { Router, type Request } from "express";
import { HttpError } from "../errors/httpError.js";
import { BacklogActivityRecorder } from "../features/history/backlogActivityRecorder.js";
import { IgdbClient, type IgdbFetch } from "../features/igdb/igdbClient.js";
import { IgdbEnrichmentService } from "../features/igdb/igdbEnrichmentService.js";
import { IgdbMetadataRefreshService } from "../features/igdb/igdbMetadataRefreshService.js";
import type { IgdbCredentials } from "../features/igdb/igdbTypes.js";
import {
  playStationApiOperations,
  playStationTrophyDetailApiOperations,
  type PlayStationApiOperations,
  type PlayStationTrophyDetailApiOperations,
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
import { PlayStationProfileProgressionService } from "../features/playstation/playStationProfileProgressionService.js";
import { PlayStationRequestGate } from "../features/playstation/playStationRequestGate.js";
import { PlayStationTitlePreviewService } from "../features/playstation/playStationTitlePreviewService.js";
import { PlayStationTitleReconciliationService } from "../features/playstation/playStationTitleReconciliationService.js";
import { PlayStationTitleLinkService } from "../features/playstation/playStationTitleLinkService.js";
import {
  readPlayStationCredentialSource,
  type PlayStationCredentialSource,
} from "../features/playstation/playStationCredentialProvider.js";
import type { PlayStationCredentials } from "../features/playstation/playStationTypes.js";
import {
  playStationPlatforms,
  playStatuses,
  type PlayStationPlatform,
  type PlayStatus,
} from "../features/library/libraryGameTypes.js";
import { PlayStationSyncCooldownService } from "../features/playstation/playStationSyncCooldownService.js";
import { PlayStationSyncExecutionLock } from "../features/playstation/playStationSyncExecutionLock.js";
import {
  PlayStationSyncProgressTracker,
  type PlayStationSyncOperation,
} from "../features/playstation/playStationSyncProgressTracker.js";
import { PlayStationTrophyArtworkService } from "../features/playstation/playStationTrophyArtworkService.js";
import { PlayStationTrophyDetailFetchService } from "../features/playstation/playStationTrophyDetailFetchService.js";
import { PlayStationTrophyDetailRepository } from "../features/playstation/playStationTrophyDetailRepository.js";
import { PlayStationTrophyDetailSyncPlanner } from "../features/playstation/playStationTrophyDetailSyncPlanner.js";
import { PlayStationTrophyDetailSyncService } from "../features/playstation/playStationTrophyDetailSyncService.js";
import { PlayStationTrophySyncService } from "../features/playstation/playStationTrophySyncService.js";

export interface PlayStationRouteOptions {
  database: DatabaseSync;
  imageCacheDirectory: string;
  imageFetch?: ImageFetch;
  igdbCredentials: IgdbCredentials;
  igdbFetch?: IgdbFetch;
  credentials: PlayStationCredentials;
  credentialProvider?: () => PlayStationCredentials;
  operations?: PlayStationApiOperations;
  detailOperations?: PlayStationTrophyDetailApiOperations;
  requestGate?: PlayStationRequestGate;
}

function readGameId(request: Request): string {
  const gameId = request.params.gameId;

  if (typeof gameId !== "string" || gameId.trim() === "") {
    throw new HttpError(400, "invalid_game_id", "A game ID is required.");
  }

  return gameId.trim();
}

function readTrophyId(request: Request): number {
  const value = request.params.trophyId;
  const trophyId = typeof value === "string" ? Number(value) : Number.NaN;

  if (!Number.isSafeInteger(trophyId) || trophyId < 0) {
    throw new HttpError(
      400,
      "invalid_trophy_id",
      "A non-negative trophy ID is required.",
    );
  }

  return trophyId;
}

function readTrophyAvailability(value: unknown): {
  unobtainable: boolean;
  reason: string | null;
} {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(
      400,
      "invalid_trophy_availability",
      "A trophy availability object is required.",
    );
  }

  const fields = value as Record<string, unknown>;
  const allowedFields = new Set(["unobtainable", "reason"]);

  if (
    Object.keys(fields).some((field) => !allowedFields.has(field)) ||
    typeof fields.unobtainable !== "boolean"
  ) {
    throw new HttpError(
      400,
      "invalid_trophy_availability",
      "unobtainable must be true or false.",
    );
  }

  if (
    fields.reason !== undefined &&
    fields.reason !== null &&
    typeof fields.reason !== "string"
  ) {
    throw new HttpError(
      400,
      "invalid_trophy_availability",
      "reason must be a string or null.",
    );
  }

  const reason =
    typeof fields.reason === "string" && fields.reason.trim() !== ""
      ? fields.reason.trim()
      : null;

  if (reason !== null && reason.length > 500) {
    throw new HttpError(
      400,
      "invalid_trophy_availability",
      "reason cannot exceed 500 characters.",
    );
  }

  return {
    unobtainable: fields.unobtainable,
    reason: fields.unobtainable ? reason : null,
  };
}

export function createPlayStationRoutes(
  options: PlayStationRouteOptions,
): Router {
  const routes = Router();

  const operations = options.operations ?? playStationApiOperations;
  const detailOperations =
    options.detailOperations ?? playStationTrophyDetailApiOperations;
  const requestGate = options.requestGate ?? new PlayStationRequestGate();

  const credentialSource: PlayStationCredentialSource =
    options.credentialProvider ?? options.credentials;

  const authorizationSession = new PlayStationAuthorizationSession(
    () => readPlayStationCredentialSource(credentialSource).readerNpsso,
    operations,
    requestGate,
  );

  const connectionService = new PlayStationConnectionService(
    credentialSource,
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

  const profileProgressionService = new PlayStationProfileProgressionService(
    options.database,
  );

  const titleLinkService = new PlayStationTitleLinkService(options.database);

  const imageCacheService = new ImageCacheService(
    new ImageCacheRepository(options.database),
    options.imageCacheDirectory,
    options.imageFetch,
  );

  const titleImageService = new PlayStationTitleImageService(imageCacheService);

  const igdbMetadataRefreshService = new IgdbMetadataRefreshService(
    options.database,
    new IgdbEnrichmentService(
      options.database,
      new IgdbClient(options.igdbCredentials, options.igdbFetch),
      imageCacheService,
    ),
  );

  const syncCooldownService = new PlayStationSyncCooldownService(
    options.database,
  );

  const syncExecutionLock = new PlayStationSyncExecutionLock();
  const syncProgressTracker = new PlayStationSyncProgressTracker();

  async function runTrackedSynchronization<T>(
    operation: PlayStationSyncOperation,
    synchronize: () => Promise<T>,
  ): Promise<T> {
    return syncExecutionLock.run(async () => {
      syncCooldownService.enforceAndRecordAttempt();
      syncProgressTracker.start(operation);

      try {
        const result = await synchronize();

        syncProgressTracker.succeed();

        return result;
      } catch (error) {
        syncProgressTracker.fail(error);
        throw error;
      }
    });
  }

  const trophySyncService = new PlayStationTrophySyncService(options.database);

  const trophyDetailRepository = new PlayStationTrophyDetailRepository(
    options.database,
    undefined,
    new BacklogActivityRecorder(options.database),
  );

  const trophyDetailSyncService = new PlayStationTrophyDetailSyncService(
    new PlayStationTrophyDetailSyncPlanner(options.database),
    new PlayStationTrophyDetailFetchService(
      authorizationSession,
      detailOperations,
      requestGate,
    ),
    trophyDetailRepository,
    new PlayStationTrophyArtworkService(
      options.database,
      imageCacheService,
      trophyDetailRepository,
    ),
  );

  routes.get("/status", (_request, response) => {
    response.json({ status: connectionService.getStatus() });
  });

  routes.get("/sync-progress", (_request, response) => {
    response.json({ progress: syncProgressTracker.getSnapshot() });
  });

  routes.get("/profile-progression", (_request, response) => {
    response.json({ progression: profileProgressionService.findLatest() });
  });

  routes.get("/games/:gameId/trophies", (request, response) => {
    const trophySet = trophyDetailRepository.findByGameId(readGameId(request));

    if (trophySet === null) {
      throw new HttpError(
        404,
        "playstation_trophy_set_not_found",
        "No locally stored PlayStation trophy set was found for this game.",
      );
    }

    response.json({ trophySet });
  });

  routes.patch(
    "/games/:gameId/trophies/:trophyId/availability",
    (request, response) => {
      const trophySet = trophyDetailRepository.updateTrophyAvailability(
        readGameId(request),
        readTrophyId(request),
        readTrophyAvailability(request.body),
      );

      if (trophySet === null) {
        throw new HttpError(
          404,
          "playstation_trophy_not_found",
          "The requested locally stored PlayStation trophy was not found.",
        );
      }

      response.json({ trophySet });
    },
  );

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
      const result = await runTrackedSynchronization("progress", async () => {
        const linkedPreview = linkedTitleSelector.select(
          await titlePreviewService.previewTitles(),
        );

        const detailSynchronization = await trophyDetailSyncService.synchronize(
          linkedPreview,
          (progress) => syncProgressTracker.update(progress),
        );

        syncProgressTracker.update({
          phase: "saving_snapshots",
          completedItems: 0,
          totalItems: linkedPreview.linkedTitleCount,
          currentItem: null,
          message: "Saving trophy snapshots and creating alerts.",
        });

        const synchronization = trophySyncService.synchronize({
          ...linkedPreview,
          requestsMade:
            linkedPreview.requestsMade + detailSynchronization.requestsMade,
        });

        return {
          synchronization,
          detailSynchronization,
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
      const result = await runTrackedSynchronization("full", async () => {
        const titlePreview = await titlePreviewService.previewTitles();

        const linkedPreview = linkedTitleSelector.select(titlePreview);

        const reconciledPreview =
          titleReconciliationService.reconcile(titlePreview);

        const preview = titleImageService.attachCachedIcons(reconciledPreview);

        titleLinkService.rememberPreview(preview);

        const detailSynchronization = await trophyDetailSyncService.synchronize(
          linkedPreview,
          (progress) => syncProgressTracker.update(progress),
        );

        syncProgressTracker.update({
          phase: "saving_snapshots",
          completedItems: 0,
          totalItems: linkedPreview.linkedTitleCount,
          currentItem: null,
          message: "Saving trophy snapshots and creating alerts.",
        });

        const synchronization = trophySyncService.synchronize({
          ...preview,
          requestsMade:
            preview.requestsMade + detailSynchronization.requestsMade,
        });

        const metadataRefresh = await igdbMetadataRefreshService.refreshAll(
          (progress) => {
            syncProgressTracker.update({
              phase: "refreshing_metadata",
              completedItems: progress.completedItems,
              totalItems: progress.totalItems,
              currentItem: progress.currentItem,
              message: progress.message,
            });
          },
        );

        return {
          synchronization,
          detailSynchronization,
          metadataRefresh,
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
