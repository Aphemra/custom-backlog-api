import { ApiError } from "../../services/api/apiClient";

const credentialErrorCodes = new Set([
  "playstation_not_configured",
  "playstation_authentication_failed",
  "playstation_refresh_failed",
  "playstation_reader_is_target",
  "playstation_account_not_found",
]);

export function getPlayStationCredentialGuidance(
  error: unknown,
): string | null {
  if (!(error instanceof ApiError) || !credentialErrorCodes.has(error.code)) {
    return null;
  }

  switch (error.code) {
    case "playstation_not_configured":
      return "PlayStation account settings are incomplete. Enter the reader account, target account, and reader NPSSO in Settings.";

    case "playstation_authentication_failed":
      return "PlayStation rejected the reader-account NPSSO. Sign in again and replace the stored NPSSO in Settings.";

    case "playstation_refresh_failed":
      return "The reader authorization could not be refreshed. Try once more; if it fails again, replace the NPSSO in Settings.";

    case "playstation_reader_is_target":
      return "The reader and target accounts must be different. Correct the account names in Settings.";

    case "playstation_account_not_found":
      return "PlayStation could not find one of the configured account names. Verify both online IDs in Settings.";

    default:
      return null;
  }
}
