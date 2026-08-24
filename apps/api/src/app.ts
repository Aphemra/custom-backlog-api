import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { healthRoutes } from "./routes/healthRoutes.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.use("/api/health", healthRoutes);

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

      response.status(500).json({
        ok: false,
        error: "internal_error",
      });
    },
  );

  return app;
}
