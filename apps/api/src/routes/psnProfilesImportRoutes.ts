import { Router } from "express";
import { readLatestPsnProfilesImport, saveLatestPsnProfilesImport } from "../features/psnprofilesImport/psnProfilesImportStore.js";
import { validatePsnProfilesUserscriptExport } from "../features/psnprofilesImport/validatePsnProfilesUserscriptExport.js";

export const psnProfilesImportRoutes = Router();

psnProfilesImportRoutes.use((_request, response, next) => {
  response.setHeader("Access-Control-Allow-Origin", "https://psnprofiles.com");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

psnProfilesImportRoutes.options("/latest", (_request, response) => {
  response.sendStatus(204);
});

psnProfilesImportRoutes.get("/latest", async (_request, response) => {
  try {
    const latestImport = await readLatestPsnProfilesImport();

    if (!latestImport) {
      response.json({
        hasExport: false,
      });
      return;
    }

    response.json({
      hasExport: true,
      savedAt: latestImport.savedAt,
      ageMs: Date.now() - Date.parse(latestImport.savedAt),
      payload: latestImport.payload,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown PSNProfiles import read failure.";

    response.status(500).json({
      hasExport: false,
      error: "psnprofiles_import_read_failed",
      message,
    });
  }
});

psnProfilesImportRoutes.post("/latest", async (request, response) => {
  try {
    const payload = validatePsnProfilesUserscriptExport(request.body);
    const storedImport = await saveLatestPsnProfilesImport(payload);

    response.json({
      ok: true,
      savedAt: storedImport.savedAt,
      gameCount: storedImport.payload.games.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown PSNProfiles import save failure.";

    response.status(400).json({
      ok: false,
      error: "invalid_psnprofiles_import",
      message,
    });
  }
});
