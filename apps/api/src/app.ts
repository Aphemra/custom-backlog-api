import type { DatabaseSync } from "node:sqlite";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { runtimeConfig } from "./config/runtimeConfig.js";
import { HttpError } from "./errors/httpError.js";
import { createCollectionRoutes } from "./routes/collectionRoutes.js";
import { createDataRoutes } from "./routes/dataRoutes.js";
import { createDatabaseRoutes } from "./routes/databaseRoutes.js";
import { createHealthRoutes } from "./routes/healthRoutes.js";
import { createImageRoutes } from "./routes/imageRoutes.js";
import { createLibraryRoutes } from "./routes/libraryRoutes.js";
import { createSavedViewRoutes } from "./routes/savedViewRoutes.js";

export function createApp(
  database: DatabaseSync,
  imageCacheDirectory: string = runtimeConfig.imageCacheDirectory,
) {
  const app = express();

  app.disable("x-powered-by");
  app.use(
    express.json({
      limit: "25mb",
    }),
  );

  app.use("/api/health", createHealthRoutes(database));

  app.use("/api/images", createImageRoutes(database, imageCacheDirectory));

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
