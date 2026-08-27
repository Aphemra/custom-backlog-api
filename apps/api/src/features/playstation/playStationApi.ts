import {
  exchangeAccessCodeForAuthTokens,
  exchangeNpssoForAccessCode,
  exchangeRefreshTokenForAuthTokens,
  getTitleTrophies,
  getTitleTrophyGroups,
  getUserTitles,
  getUserTrophiesEarnedForTitle,
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

export interface PlayStationTrophyDetailRequestOptions {
  npServiceName: "trophy" | "trophy2";
  limit: number;
  offset: number;
}

export interface PlayStationTrophyDetailApiOperations {
  getTrophyGroups(
    authorization: PlayStationAuthorization,
    npCommunicationId: string,
    options: {
      npServiceName: "trophy" | "trophy2";
    },
  ): Promise<unknown>;
  getTrophyDefinitions(
    authorization: PlayStationAuthorization,
    npCommunicationId: string,
    trophyGroupId: "all",
    options: PlayStationTrophyDetailRequestOptions,
  ): Promise<unknown>;
  getTrophyEarnings(
    authorization: PlayStationAuthorization,
    accountId: string,
    npCommunicationId: string,
    trophyGroupId: "all",
    options: PlayStationTrophyDetailRequestOptions,
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

export const playStationTrophyDetailApiOperations: PlayStationTrophyDetailApiOperations =
  {
    getTrophyGroups: getTitleTrophyGroups,
    getTrophyDefinitions: getTitleTrophies,
    getTrophyEarnings: getUserTrophiesEarnedForTitle,
  };
