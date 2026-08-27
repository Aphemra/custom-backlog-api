import type { DatabaseSync } from "node:sqlite";
import { Router } from "express";
import { AppSettingsRepository } from "../features/settings/appSettingsRepository.js";
import { parseUpdateAppSettingsInput } from "../features/settings/appSettingsValidation.js";

export function createSettingsRoutes(database: DatabaseSync): Router {
  const routes = Router();

  const repository = new AppSettingsRepository(database);

  routes.get("/", (_request, response) => {
    response.json({
      settings: repository.get(),
    });
  });

  routes.patch("/", (request, response) => {
    const input = parseUpdateAppSettingsInput(request.body);

    response.json({
      settings: repository.update(input),
    });
  });

  return routes;
}
