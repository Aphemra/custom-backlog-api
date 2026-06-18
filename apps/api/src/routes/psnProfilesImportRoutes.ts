import { Router } from "express";
import { readLatestPsnProfilesImport, saveLatestPsnProfilesImport } from "../features/psnprofilesImport/psnProfilesImportStore.js";
import { validatePsnProfilesUserscriptExport } from "../features/psnprofilesImport/validatePsnProfilesUserscriptExport.js";

export const psnProfilesImportRoutes = Router();

const allowedOrigins = new Set(["https://psnprofiles.com", "http://localhost:5173", "http://127.0.0.1:5173"]);

psnProfilesImportRoutes.use((request, response, next) => {
  const origin = request.headers.origin;

  if (origin && allowedOrigins.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }

  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (request.method === "OPTIONS") {
    response.sendStatus(204);
    return;
  }

  next();
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
