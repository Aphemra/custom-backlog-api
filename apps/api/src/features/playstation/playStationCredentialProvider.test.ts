import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { openDatabase } from "../../database/database.js";
import { LocalSecretCipher } from "../settings/localSecretCipher.js";
import { PlayStationCredentialSettingsRepository } from "../settings/playStationCredentialSettingsRepository.js";
import { PlayStationCredentialProvider } from "./playStationCredentialProvider.js";

test("uses local credentials together and otherwise falls back to environment credentials", () => {
  const database = openDatabase(":memory:");

  try {
    const repository = new PlayStationCredentialSettingsRepository(
      database,
      new LocalSecretCipher(randomBytes(32)),
    );

    const provider = new PlayStationCredentialProvider(repository, {
      readerNpsso: "e".repeat(64),
      readerOnlineId: "EnvironmentReader",
      targetOnlineId: "EnvironmentMain",
    });

    assert.deepEqual(provider.getCredentials(), {
      readerNpsso: "e".repeat(64),
      readerOnlineId: "EnvironmentReader",
      targetOnlineId: "EnvironmentMain",
    });

    repository.update({
      readerOnlineId: "LocalReader",
    });

    assert.deepEqual(provider.getCredentials(), {
      readerNpsso: null,
      readerOnlineId: "LocalReader",
      targetOnlineId: null,
    });

    repository.update({
      targetOnlineId: "LocalMain",
      readerNpsso: "l".repeat(64),
    });

    assert.deepEqual(provider.getCredentials(), {
      readerNpsso: "l".repeat(64),
      readerOnlineId: "LocalReader",
      targetOnlineId: "LocalMain",
    });
  } finally {
    database.close();
  }
});
