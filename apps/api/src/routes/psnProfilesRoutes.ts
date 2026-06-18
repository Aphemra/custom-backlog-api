import { Router } from "express";
import { getPsnProfilesIntegrationStatus } from "../features/psnprofiles/psnProfilesConfig.js";
import { getPsnProfilesProfileSummary } from "../features/psnprofiles/getPsnProfilesProfileSummary.js";
import { PsnProfilesHttpError } from "../features/psnprofiles/psnProfilesHttpClient.js";

export const psnProfilesRoutes = Router();

psnProfilesRoutes.get("/status", (_request, response) => {
  response.json(getPsnProfilesIntegrationStatus());
});

psnProfilesRoutes.get("/profile/:psnId", async (request, response) => {
  const psnId = request.params.psnId?.trim();

  if (!psnId) {
    response.status(400).json({
      error: "missing_psn_id",
      message: "A PSN ID is required.",
    });
    return;
  }

  try {
    const profileSummary = await getPsnProfilesProfileSummary(psnId);

    response.json({
      ok: true,
      profile: profileSummary,
    });
  } catch (error) {
    if (error instanceof PsnProfilesHttpError && error.status === 403) {
      response.status(403).json({
        ok: false,
        error: "psnprofiles_blocked",
        message: "PSNProfiles rejected the server-side request. Use manual PSNProfiles URL linking or a user-provided HTML import workflow instead.",
      });
      return;
    }

    const message = error instanceof Error ? error.message : "Unknown PSNProfiles profile lookup failure.";

    response.status(502).json({
      ok: false,
      error: "psnprofiles_lookup_failed",
      message,
    });
  }
});
