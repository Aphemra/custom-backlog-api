import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { openDatabase } from "../../database/database.js";
import { LocalSecretCipher } from "./localSecretCipher.js";
import { PlayStationCredentialSettingsRepository } from "./playStationCredentialSettingsRepository.js";

interface RawCredentialRow {
  npsso_ciphertext: string | null;
  npsso_iv: string | null;
  npsso_auth_tag: string | null;
}

test("stores the NPSSO encrypted and preserves partial updates", () => {
  const database = openDatabase(":memory:");
  const cipher = new LocalSecretCipher(randomBytes(32));

  const repository = new PlayStationCredentialSettingsRepository(
    database,
    cipher,
    () => new Date("2026-08-29T12:00:00.000Z"),
  );

  const npsso = "n".repeat(64);

  try {
    assert.deepEqual(repository.get(), {
      readerOnlineId: null,
      targetOnlineId: null,
      readerNpsso: null,
      npssoUpdatedAt: null,
      npssoExpectedRenewalAt: null,
      renewalReminderDays: 7,
    });

    assert.deepEqual(
      repository.update({
        readerOnlineId: "BacklogReader",
        targetOnlineId: "MainAccount",
        readerNpsso: npsso,
      }),
      {
        readerOnlineId: "BacklogReader",
        targetOnlineId: "MainAccount",
        readerNpsso: npsso,
        npssoUpdatedAt: "2026-08-29T12:00:00.000Z",
        npssoExpectedRenewalAt: "2026-10-28T12:00:00.000Z",
        renewalReminderDays: 7,
      },
    );

    const rawRow = database
      .prepare(
        `
        SELECT
          npsso_ciphertext,
          npsso_iv,
          npsso_auth_tag
        FROM playstation_credential_settings
        WHERE id = 1
      `,
      )
      .get() as unknown as RawCredentialRow;

    assert.notEqual(rawRow.npsso_ciphertext, npsso);
    assert.equal(JSON.stringify(rawRow).includes(npsso), false);

    assert.deepEqual(
      repository.update({
        renewalReminderDays: 10,
      }),
      {
        readerOnlineId: "BacklogReader",
        targetOnlineId: "MainAccount",
        readerNpsso: npsso,
        npssoUpdatedAt: "2026-08-29T12:00:00.000Z",
        npssoExpectedRenewalAt: "2026-10-28T12:00:00.000Z",
        renewalReminderDays: 10,
      },
    );

    assert.deepEqual(
      repository.update({
        readerNpsso: null,
      }),
      {
        readerOnlineId: "BacklogReader",
        targetOnlineId: "MainAccount",
        readerNpsso: null,
        npssoUpdatedAt: null,
        npssoExpectedRenewalAt: null,
        renewalReminderDays: 10,
      },
    );
  } finally {
    database.close();
  }
});
