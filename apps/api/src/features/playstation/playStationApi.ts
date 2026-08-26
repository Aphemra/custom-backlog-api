import {
  exchangeAccessCodeForAuthTokens,
  exchangeNpssoForAccessCode,
  getUserTrophyProfileSummary,
  makeUniversalSearch,
} from "psn-api";

export interface PlayStationAuthorization {
  accessToken: string;
}

export interface PlayStationApiOperations {
  exchangeNpssoForAccessCode(npsso: string): Promise<unknown>;
  exchangeAccessCodeForAuthTokens(accessCode: string): Promise<unknown>;
  searchAccounts(
    authorization: PlayStationAuthorization,
    onlineId: string,
  ): Promise<unknown>;
  getTrophySummary(
    authorization: PlayStationAuthorization,
    accountId: string,
  ): Promise<unknown>;
}

export const playStationApiOperations: PlayStationApiOperations = {
  exchangeNpssoForAccessCode,
  exchangeAccessCodeForAuthTokens,
  searchAccounts: async (authorization, onlineId) =>
    makeUniversalSearch(authorization, onlineId, "SocialAllAccounts"),
  getTrophySummary: getUserTrophyProfileSummary,
};
