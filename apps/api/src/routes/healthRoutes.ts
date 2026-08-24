import type { DatabaseSync } from "node:sqlite";
import { Router } from "express";
import { getDatabaseStatus } from "../database/getDatabaseStatus.js";

export function createHealthRoutes(database: DatabaseSync): Router {
  const healthRoutes = Router();

  healthRoutes.get("/", (_request, response) => {
    response.json({
      ok: true,
      service: "trophy-backlog-api",
      version: 2,
      database: getDatabaseStatus(database),
    });
  });

  return healthRoutes;
}
