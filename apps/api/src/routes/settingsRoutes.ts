import type { DatabaseSync } from "node:sqlite";
import { Router } from "express";
import { AppSettingsRepository } from "../features/settings/appSettingsRepository.js";
import { loadOrCreateLocalSecretCipher } from "../features/settings/localSecretCipher.js";
import { PlayStationCredentialSettingsRepository } from "../features/settings/playStationCredentialSettingsRepository.js";
import type {
  PlayStationCredentialSettingsSummary,
  StoredPlayStationCredentialSettings,
} from "../features/settings/playStationCredentialSettingsTypes.js";
import {
  parseUpdatePlayStationCredentialSettingsInput,
  requireDistinctPlayStationAccounts,
} from "../features/settings/playStationCredentialSettingsValidation.js";
import { parseUpdateAppSettingsInput } from "../features/settings/appSettingsValidation.js";

function summarizePlayStationSettings(
  settings: StoredPlayStationCredentialSettings,
): PlayStationCredentialSettingsSummary {
  return {
    readerOnlineId: settings.readerOnlineId,
    targetOnlineId: settings.targetOnlineId,
    hasNpsso: settings.readerNpsso !== null,
    npssoUpdatedAt: settings.npssoUpdatedAt,
    npssoExpectedRenewalAt: settings.npssoExpectedRenewalAt,
    renewalReminderDays: settings.renewalReminderDays,
  };
}

export function createSettingsRoutes(
  database: DatabaseSync,
  credentialKeyPath: string,
): Router {
  const routes = Router();
  const repository = new AppSettingsRepository(database);

  let credentialRepository: PlayStationCredentialSettingsRepository | null =
    null;

  function getCredentialRepository(): PlayStationCredentialSettingsRepository {
    credentialRepository ??= new PlayStationCredentialSettingsRepository(
      database,
      loadOrCreateLocalSecretCipher(credentialKeyPath),
    );

    return credentialRepository;
  }

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

  routes.get("/playstation", (_request, response) => {
    response.json({
      settings: summarizePlayStationSettings(getCredentialRepository().get()),
    });
  });

  routes.patch("/playstation", (request, response) => {
    const credentialSettingsRepository = getCredentialRepository();

    const current = credentialSettingsRepository.get();

    const input = parseUpdatePlayStationCredentialSettingsInput(request.body);

    requireDistinctPlayStationAccounts(current, input);

    const updated = credentialSettingsRepository.update(input);

    response.json({
      settings: summarizePlayStationSettings(updated),
    });
  });

  return routes;
}
