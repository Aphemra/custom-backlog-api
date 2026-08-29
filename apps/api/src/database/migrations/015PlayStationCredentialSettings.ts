import type { Migration } from "../migration.js";

export const playStationCredentialSettingsMigration: Migration = {
  version: 15,
  name: "playstation_credential_settings",
  sql: `
    CREATE TABLE playstation_credential_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      reader_online_id TEXT,
      target_online_id TEXT,
      npsso_ciphertext TEXT,
      npsso_iv TEXT,
      npsso_auth_tag TEXT,
      npsso_updated_at TEXT,
      npsso_expected_renewal_at TEXT,
      renewal_reminder_days INTEGER NOT NULL DEFAULT 7
        CHECK (
          renewal_reminder_days >= 1 AND
          renewal_reminder_days <= 30
        ),
      updated_at TEXT NOT NULL,
      CHECK (
        (
          npsso_ciphertext IS NULL AND
          npsso_iv IS NULL AND
          npsso_auth_tag IS NULL AND
          npsso_updated_at IS NULL AND
          npsso_expected_renewal_at IS NULL
        ) OR (
          npsso_ciphertext IS NOT NULL AND
          npsso_iv IS NOT NULL AND
          npsso_auth_tag IS NOT NULL AND
          npsso_updated_at IS NOT NULL AND
          npsso_expected_renewal_at IS NOT NULL
        )
      )
    );

    INSERT INTO playstation_credential_settings (
      id,
      reader_online_id,
      target_online_id,
      npsso_ciphertext,
      npsso_iv,
      npsso_auth_tag,
      npsso_updated_at,
      npsso_expected_renewal_at,
      renewal_reminder_days,
      updated_at
    ) VALUES (
      1,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      7,
      CURRENT_TIMESTAMP
    );
  `,
};
