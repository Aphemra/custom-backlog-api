import type { DatabaseSync } from "node:sqlite";
import type { EncryptedLocalSecret } from "./localSecretCipher.js";
import { LocalSecretCipher } from "./localSecretCipher.js";
import {
  DEFAULT_NPSSO_REMINDER_DAYS,
  DEFAULT_NPSSO_RENEWAL_DAYS,
  type StoredPlayStationCredentialSettings,
  type UpdatePlayStationCredentialSettingsInput,
} from "./playStationCredentialSettingsTypes.js";

interface CredentialSettingsRow {
  reader_online_id: string | null;
  target_online_id: string | null;
  npsso_ciphertext: string | null;
  npsso_iv: string | null;
  npsso_auth_tag: string | null;
  npsso_updated_at: string | null;
  npsso_expected_renewal_at: string | null;
  renewal_reminder_days: number;
}

function addDays(date: Date, days: number): string {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1_000).toISOString();
}

export class PlayStationCredentialSettingsRepository {
  constructor(
    private readonly database: DatabaseSync,
    private readonly cipher: LocalSecretCipher,
    private readonly now: () => Date = () => new Date(),
  ) {}

  get(): StoredPlayStationCredentialSettings {
    const row = this.requireRow();

    return {
      readerOnlineId: row.reader_online_id,
      targetOnlineId: row.target_online_id,
      readerNpsso: this.decryptNpsso(row),
      npssoUpdatedAt: row.npsso_updated_at,
      npssoExpectedRenewalAt: row.npsso_expected_renewal_at,
      renewalReminderDays: row.renewal_reminder_days,
    };
  }

  update(
    input: UpdatePlayStationCredentialSettingsInput,
  ): StoredPlayStationCredentialSettings {
    const current = this.requireRow();
    const timestamp = this.now();

    let encryptedNpsso: EncryptedLocalSecret | null =
      this.readEncryptedNpsso(current);

    let npssoUpdatedAt = current.npsso_updated_at;
    let npssoExpectedRenewalAt = current.npsso_expected_renewal_at;

    if (Object.hasOwn(input, "readerNpsso")) {
      if (input.readerNpsso === null) {
        encryptedNpsso = null;
        npssoUpdatedAt = null;
        npssoExpectedRenewalAt = null;
      } else if (input.readerNpsso !== undefined) {
        encryptedNpsso = this.cipher.encrypt(input.readerNpsso);
        npssoUpdatedAt = timestamp.toISOString();
        npssoExpectedRenewalAt = addDays(timestamp, DEFAULT_NPSSO_RENEWAL_DAYS);
      }
    }

    this.database
      .prepare(
        `
        UPDATE playstation_credential_settings
        SET
          reader_online_id = ?,
          target_online_id = ?,
          npsso_ciphertext = ?,
          npsso_iv = ?,
          npsso_auth_tag = ?,
          npsso_updated_at = ?,
          npsso_expected_renewal_at = ?,
          renewal_reminder_days = ?,
          updated_at = ?
        WHERE id = 1
      `,
      )
      .run(
        Object.hasOwn(input, "readerOnlineId")
          ? (input.readerOnlineId ?? null)
          : current.reader_online_id,
        Object.hasOwn(input, "targetOnlineId")
          ? (input.targetOnlineId ?? null)
          : current.target_online_id,
        encryptedNpsso?.ciphertext ?? null,
        encryptedNpsso?.initializationVector ?? null,
        encryptedNpsso?.authenticationTag ?? null,
        npssoUpdatedAt,
        npssoExpectedRenewalAt,
        input.renewalReminderDays ??
          current.renewal_reminder_days ??
          DEFAULT_NPSSO_REMINDER_DAYS,
        timestamp.toISOString(),
      );

    return this.get();
  }

  private decryptNpsso(row: CredentialSettingsRow): string | null {
    const encryptedNpsso = this.readEncryptedNpsso(row);

    return encryptedNpsso === null ? null : this.cipher.decrypt(encryptedNpsso);
  }

  private readEncryptedNpsso(
    row: CredentialSettingsRow,
  ): EncryptedLocalSecret | null {
    if (
      row.npsso_ciphertext === null ||
      row.npsso_iv === null ||
      row.npsso_auth_tag === null
    ) {
      return null;
    }

    return {
      ciphertext: row.npsso_ciphertext,
      initializationVector: row.npsso_iv,
      authenticationTag: row.npsso_auth_tag,
    };
  }

  private requireRow(): CredentialSettingsRow {
    const row = this.database
      .prepare(
        `
        SELECT
          reader_online_id,
          target_online_id,
          npsso_ciphertext,
          npsso_iv,
          npsso_auth_tag,
          npsso_updated_at,
          npsso_expected_renewal_at,
          renewal_reminder_days
        FROM playstation_credential_settings
        WHERE id = 1
      `,
      )
      .get() as unknown as CredentialSettingsRow | undefined;

    if (row === undefined) {
      throw new Error(
        "The local PlayStation credential settings record is missing.",
      );
    }

    return row;
  }
}
