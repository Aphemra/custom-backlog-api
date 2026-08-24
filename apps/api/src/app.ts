import type { DatabaseSync } from "node:sqlite";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { runtimeConfig } from "./config/runtimeConfig.js";
import { createDatabaseRoutes } from "./routes/databaseRoutes.js";
import { createHealthRoutes } from "./routes/healthRoutes.js";

export function createApp(database: DatabaseSync) {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.use("/api/health", createHealthRoutes(database));

  app.use(
    "/api/database",
    createDatabaseRoutes(database, runtimeConfig.backupDirectory),
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

      console.error(error);

      response.status(500).json({
        ok: false,
        error: "internal_error",
      });
    },
  );

  return app;
}
