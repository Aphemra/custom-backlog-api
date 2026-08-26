import type { DatabaseSync } from "node:sqlite";
import { Router } from "express";
import {
  createPortableDataExport,
  importPortableData,
  previewPortableImport,
} from "../features/portableData/portableDataService.js";
import { parsePortableDataExport } from "../features/portableData/portableDataValidation.js";

export function createDataRoutes(
  database: DatabaseSync,
  backupDirectory: string,
): Router {
  const dataRoutes = Router();

  dataRoutes.get("/export", (_request, response) => {
    const portableData = createPortableDataExport(database);

    const safeTimestamp = portableData.exportedAt
      .replaceAll(":", "-")
      .replaceAll(".", "-");

    response.setHeader(
      "content-disposition",
      `attachment; filename="trophy-backlog-${safeTimestamp}.json"`,
    );

    response.json(portableData);
  });

  dataRoutes.post("/imports/preview", (request, response) => {
    const portableData = parsePortableDataExport(request.body);

    response.json(previewPortableImport(database, portableData));
  });

  dataRoutes.post("/imports", async (request, response, next) => {
    try {
      const portableData = parsePortableDataExport(request.body);

      const result = await importPortableData(
        database,
        backupDirectory,
        portableData,
      );

      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  return dataRoutes;
}
