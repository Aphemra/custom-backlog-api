export const DEFAULT_NPSSO_RENEWAL_DAYS = 60;
export const DEFAULT_NPSSO_REMINDER_DAYS = 7;

export interface StoredPlayStationCredentialSettings {
  readonly readerOnlineId: string | null;
  readonly targetOnlineId: string | null;
  readonly readerNpsso: string | null;
  readonly npssoUpdatedAt: string | null;
  readonly npssoExpectedRenewalAt: string | null;
  readonly renewalReminderDays: number;
}

export interface UpdatePlayStationCredentialSettingsInput {
  readonly readerOnlineId?: string | null;
  readonly targetOnlineId?: string | null;
  readonly readerNpsso?: string | null;
  readonly renewalReminderDays?: number;
}

export interface PlayStationCredentialSettingsSummary {
  readonly readerOnlineId: string | null;
  readonly targetOnlineId: string | null;
  readonly hasNpsso: boolean;
  readonly npssoUpdatedAt: string | null;
  readonly npssoExpectedRenewalAt: string | null;
  readonly renewalReminderDays: number;
}
