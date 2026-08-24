import type { DatabaseSync } from "node:sqlite";
import { Router } from "express";
import { getDatabaseStatus } from "../database/getDatabaseStatus.js";
import { createDatabaseBackup } from "../features/backups/createDatabaseBackup.js";

export function createDatabaseRoutes(
  database: DatabaseSync,
  backupDirectory: string,
): Router {
  const databaseRoutes = Router();

  databaseRoutes.get("/status", (_request, response) => {
    response.json(getDatabaseStatus(database));
  });

  databaseRoutes.post("/backups", async (_request, response, next) => {
    try {
      const result = await createDatabaseBackup(database, backupDirectory);

      response.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  return databaseRoutes;
}
