import { existsSync } from "node:fs";
import { extname, resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { runtimeConfig } from "./config/runtimeConfig.js";
import { HttpError } from "./errors/httpError.js";
import type { IgdbFetch } from "./features/igdb/igdbClient.js";
import type { IgdbCredentials } from "./features/igdb/igdbTypes.js";
import { PlayStationCredentialProvider } from "./features/playstation/playStationCredentialProvider.js";
import { loadOrCreateLocalSecretCipher } from "./features/settings/localSecretCipher.js";
import { PlayStationCredentialSettingsRepository } from "./features/settings/playStationCredentialSettingsRepository.js";
import { createCollectionRoutes } from "./routes/collectionRoutes.js";
import { createDataRoutes } from "./routes/dataRoutes.js";
import { createDatabaseRoutes } from "./routes/databaseRoutes.js";
import { createHealthRoutes } from "./routes/healthRoutes.js";
import { createHistoryRoutes } from "./routes/historyRoutes.js";
import { createImageRoutes } from "./routes/imageRoutes.js";
import { createIgdbRoutes } from "./routes/igdbRoutes.js";
import { createLibraryRoutes } from "./routes/libraryRoutes.js";
import { createTrophyAlertRoutes } from "./routes/trophyAlertRoutes.js";
import {
  createPlayStationRoutes,
  type PlayStationRouteOptions,
} from "./routes/playStationRoutes.js";
import { createSavedViewRoutes } from "./routes/savedViewRoutes.js";
import { createSettingsRoutes } from "./routes/settingsRoutes.js";

export function createApp(
  database: DatabaseSync,
  imageCacheDirectory: string = runtimeConfig.imageCacheDirectory,
  igdbCredentials: IgdbCredentials = {
    clientId: runtimeConfig.igdbClientId,
    clientSecret: runtimeConfig.igdbClientSecret,
  },
  externalFetch: IgdbFetch = fetch,
  playStationOptions: Partial<PlayStationRouteOptions> = {},
  credentialKeyPath: string = runtimeConfig.credentialKeyPath,
  webDirectory: string = runtimeConfig.webDirectory,
) {
  const app = express();

  let localPlayStationCredentialProvider: PlayStationCredentialProvider | null =
    null;

  function readRuntimePlayStationCredentials() {
    localPlayStationCredentialProvider ??= new PlayStationCredentialProvider(
      new PlayStationCredentialSettingsRepository(
        database,
        loadOrCreateLocalSecretCipher(credentialKeyPath),
      ),
      runtimeConfig.playStationCredentials,
    );

    return localPlayStationCredentialProvider.getCredentials();
  }

  const credentialProvider =
    playStationOptions.credentialProvider ??
    (playStationOptions.credentials === undefined
      ? readRuntimePlayStationCredentials
      : undefined);

  app.disable("x-powered-by");
  app.use(
    express.json({
      limit: "25mb",
    }),
  );

  app.use("/api/health", createHealthRoutes(database));

  app.use(
    "/api/images",
    createImageRoutes(database, imageCacheDirectory, externalFetch),
  );

  app.use(
    "/api/integrations/igdb",
    createIgdbRoutes(
      database,
      imageCacheDirectory,
      igdbCredentials,
      externalFetch,
    ),
  );

  app.use(
    "/api/integrations/playstation",
    createPlayStationRoutes({
      database,
      imageCacheDirectory,
      imageFetch: externalFetch,
      igdbCredentials: playStationOptions.igdbCredentials ?? igdbCredentials,
      igdbFetch: playStationOptions.igdbFetch ?? externalFetch,
      credentials:
        playStationOptions.credentials ?? runtimeConfig.playStationCredentials,
      ...(credentialProvider === undefined ? {} : { credentialProvider }),
      ...(playStationOptions.operations === undefined
        ? {}
        : { operations: playStationOptions.operations }),
      ...(playStationOptions.detailOperations === undefined
        ? {}
        : {
            detailOperations: playStationOptions.detailOperations,
          }),
      ...(playStationOptions.requestGate === undefined
        ? {}
        : { requestGate: playStationOptions.requestGate }),
    }),
  );

  app.use(
    "/api/database",
    createDatabaseRoutes(database, runtimeConfig.backupDirectory),
  );

  app.use("/api/library", createLibraryRoutes(database));

  app.use("/api/collections", createCollectionRoutes(database));

  app.use("/api/saved-views", createSavedViewRoutes(database));

  app.use("/api/settings", createSettingsRoutes(database, credentialKeyPath));

  app.use("/api/trophy-alerts", createTrophyAlertRoutes(database));

  app.use("/api/history", createHistoryRoutes(database));

  app.use(
    "/api/data",
    createDataRoutes(database, runtimeConfig.backupDirectory),
  );

  app.use("/api", (_request, response) => {
    response.status(404).json({
      ok: false,
      error: "api_route_not_found",
    });
  });

  const webIndexPath = resolve(webDirectory, "index.html");

  if (existsSync(webIndexPath)) {
    app.use(
      express.static(webDirectory, {
        index: false,
      }),
    );

    app.use((request, response, next) => {
      if (request.method !== "GET" || extname(request.path) !== "") {
        next();
        return;
      }

      response.sendFile(
        webIndexPath,
        {
          headers: {
            "Cache-Control": "no-cache",
          },
        },
        (error) => {
          if (error !== undefined) {
            next(error);
          }
        },
      );
    });
  }

  app.use(
    (
      error: unknown,
      _request: Request,
      response: Response,
      _next: NextFunction,
    ) => {
      if (error instanceof SyntaxError) {
        response.status(400).json({
          ok: false,
          error: "invalid_json",
        });
        return;
      }

      if (error instanceof HttpError) {
        response.status(error.statusCode).json({
          ok: false,
          error: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        });

        return;
      }

      console.error(error);

      response.status(500).json({
        ok: false,
        error: "internal_error",
      });
    },
  );

  return app;
}
