import {
  exchangeAccessCodeForAuthTokens,
  exchangeNpssoForAccessCode,
  exchangeRefreshTokenForAuthTokens,
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
}

export const playStationApiOperations: PlayStationApiOperations = {
  exchangeNpssoForAccessCode,
  exchangeAccessCodeForAuthTokens,
  exchangeRefreshTokenForAuthTokens,
  searchAccounts: async (authorization, onlineId) =>
    makeUniversalSearch(authorization, onlineId, "SocialAllAccounts"),
  getTrophySummary: getUserTrophyProfileSummary,
};
