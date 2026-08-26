import {
  exchangeAccessCodeForAuthTokens,
  exchangeNpssoForAccessCode,
  exchangeRefreshTokenForAuthTokens,
  getUserTitles,
  getUserTrophyProfileSummary,
  makeUniversalSearch,
} from "psn-api";

export interface PlayStationAuthorization {
  accessToken: string;
}

export interface PlayStationApiOperations {
  exchangeNpssoForAccessCode(npsso: string): Promise<unknown>;
  exchangeAccessCodeForAuthTokens(accessCode: string): Promise<unknown>;
  exchangeRefreshTokenForAuthTokens(refreshToken: string): Promise<unknown>;
  searchAccounts(
    authorization: PlayStationAuthorization,
    onlineId: string,
  ): Promise<unknown>;
  getTrophySummary(
    authorization: PlayStationAuthorization,
    accountId: string,
  ): Promise<unknown>;
  getTrophyTitles(
    authorization: PlayStationAuthorization,
    accountId: string,
    options: { limit: number; offset: number },
  ): Promise<unknown>;
}

export const playStationApiOperations: PlayStationApiOperations = {
  exchangeNpssoForAccessCode,
  exchangeAccessCodeForAuthTokens,
  exchangeRefreshTokenForAuthTokens,

  searchAccounts: async (authorization, onlineId) =>
    makeUniversalSearch(authorization, onlineId, "SocialAllAccounts"),

  getTrophySummary: getUserTrophyProfileSummary,
  getTrophyTitles: getUserTitles,
};
