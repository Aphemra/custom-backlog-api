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
import { createCollectionRoutes } from "./routes/collectionRoutes.js";
import { createDataRoutes } from "./routes/dataRoutes.js";
import { createDatabaseRoutes } from "./routes/databaseRoutes.js";
import { createHealthRoutes } from "./routes/healthRoutes.js";
import { createImageRoutes } from "./routes/imageRoutes.js";
import { createIgdbRoutes } from "./routes/igdbRoutes.js";
import { createLibraryRoutes } from "./routes/libraryRoutes.js";
import {
  createPlayStationRoutes,
  type PlayStationRouteOptions,
} from "./routes/playStationRoutes.js";
import { createSavedViewRoutes } from "./routes/savedViewRoutes.js";

export function createApp(
  database: DatabaseSync,
  imageCacheDirectory: string = runtimeConfig.imageCacheDirectory,
  igdbCredentials: IgdbCredentials = {
    clientId: runtimeConfig.igdbClientId,
    clientSecret: runtimeConfig.igdbClientSecret,
  },
  externalFetch: IgdbFetch = fetch,
  playStationOptions: Partial<PlayStationRouteOptions> = {},
) {
  const app = express();

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
      credentials:
        playStationOptions.credentials ?? runtimeConfig.playStationCredentials,
      ...(playStationOptions.operations === undefined
        ? {}
        : { operations: playStationOptions.operations }),
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
