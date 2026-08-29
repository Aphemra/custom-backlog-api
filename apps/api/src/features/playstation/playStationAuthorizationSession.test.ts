import assert from "node:assert/strict";
import { test } from "node:test";
import type { PlayStationApiOperations } from "./playStationApi.js";
import { PlayStationAuthorizationSession } from "./playStationAuthorizationSession.js";
import { PlayStationRequestGate } from "./playStationRequestGate.js";

function unusedOperation(): Promise<never> {
  return Promise.reject(new Error("This operation should not be called."));
}

test("shares initial authentication and reuses a fresh access token", async () => {
  let codeExchanges = 0;
  let tokenExchanges = 0;

  const operations: PlayStationApiOperations = {
    async getTrophyTitles() {
      throw new Error("Trophy titles should not be requested.");
    },
    async exchangeNpssoForAccessCode(npsso) {
      assert.equal(npsso, "n".repeat(64));
      codeExchanges += 1;
      return "access-code";
    },

    async exchangeAccessCodeForAuthTokens() {
      tokenExchanges += 1;

      return {
        accessToken: "access-token",
        expiresIn: 3_600,
        refreshToken: "refresh-token",
        refreshTokenExpiresIn: 7_200,
      };
    },

    exchangeRefreshTokenForAuthTokens: unusedOperation,
    searchAccounts: unusedOperation,
    getTrophySummary: unusedOperation,
  };

  const session = new PlayStationAuthorizationSession(
    "n".repeat(64),
    operations,
    new PlayStationRequestGate({
      minimumIntervalMs: 0,
    }),
    () => 1_000,
  );

  const authorizations = await Promise.all([
    session.getAuthorization(),
    session.getAuthorization(),
    session.getAuthorization(),
  ]);

  assert.deepEqual(authorizations, [
    { accessToken: "access-token" },
    { accessToken: "access-token" },
    { accessToken: "access-token" },
  ]);

  assert.equal(codeExchanges, 1);
  assert.equal(tokenExchanges, 1);

  assert.deepEqual(await session.getAuthorization(), {
    accessToken: "access-token",
  });

  assert.equal(codeExchanges, 1);
  assert.equal(tokenExchanges, 1);
});

test("refreshes an expired access token without reusing the NPSSO", async () => {
  let currentTime = 1_000;
  let codeExchanges = 0;
  let refreshExchanges = 0;

  const operations: PlayStationApiOperations = {
    async getTrophyTitles() {
      throw new Error("Trophy titles should not be requested.");
    },
    async exchangeNpssoForAccessCode() {
      codeExchanges += 1;
      return "access-code";
    },

    async exchangeAccessCodeForAuthTokens() {
      return {
        accessToken: "first-access-token",
        expiresIn: 120,
        refreshToken: "refresh-token",
        refreshTokenExpiresIn: 7_200,
      };
    },

    async exchangeRefreshTokenForAuthTokens(refreshToken) {
      assert.equal(refreshToken, "refresh-token");
      refreshExchanges += 1;

      return {
        accessToken: "second-access-token",
        expiresIn: 3_600,
        refreshToken,
        refreshTokenExpiresIn: 7_080,
      };
    },

    searchAccounts: unusedOperation,
    getTrophySummary: unusedOperation,
  };

  const session = new PlayStationAuthorizationSession(
    "n".repeat(64),
    operations,
    new PlayStationRequestGate({
      minimumIntervalMs: 0,
    }),
    () => currentTime,
  );

  assert.deepEqual(await session.getAuthorization(), {
    accessToken: "first-access-token",
  });

  currentTime += 61_000;

  assert.deepEqual(await session.getAuthorization(), {
    accessToken: "second-access-token",
  });

  assert.equal(codeExchanges, 1);
  assert.equal(refreshExchanges, 1);
});

test("stops after a failed refresh instead of silently reauthenticating", async () => {
  let currentTime = 1_000;
  let codeExchanges = 0;

  const operations: PlayStationApiOperations = {
    async getTrophyTitles() {
      throw new Error("Trophy titles should not be requested.");
    },
    async exchangeNpssoForAccessCode() {
      codeExchanges += 1;
      return "access-code";
    },

    async exchangeAccessCodeForAuthTokens() {
      return {
        accessToken: "access-token",
        expiresIn: 120,
        refreshToken: "refresh-token",
        refreshTokenExpiresIn: 7_200,
      };
    },

    async exchangeRefreshTokenForAuthTokens() {
      throw new Error("simulated refresh failure");
    },

    searchAccounts: unusedOperation,
    getTrophySummary: unusedOperation,
  };

  const session = new PlayStationAuthorizationSession(
    "n".repeat(64),
    operations,
    new PlayStationRequestGate({
      minimumIntervalMs: 0,
    }),
    () => currentTime,
  );

  await session.getAuthorization();
  currentTime += 61_000;

  await assert.rejects(
    session.getAuthorization(),
    /Try the action again to authenticate afresh/,
  );

  assert.equal(codeExchanges, 1);
});

test("reauthenticates when the configured NPSSO changes", async () => {
  let currentNpsso = "a".repeat(64);
  const usedNpssoValues: string[] = [];

  const operations: PlayStationApiOperations = {
    async getTrophyTitles() {
      throw new Error("Trophy titles should not be requested.");
    },

    async exchangeNpssoForAccessCode(npsso) {
      usedNpssoValues.push(npsso);

      return npsso.startsWith("a") ? "first-code" : "second-code";
    },

    async exchangeAccessCodeForAuthTokens(accessCode) {
      return {
        accessToken:
          accessCode === "first-code"
            ? "first-access-token"
            : "second-access-token",
        expiresIn: 3_600,
        refreshToken:
          accessCode === "first-code"
            ? "first-refresh-token"
            : "second-refresh-token",
        refreshTokenExpiresIn: 7_200,
      };
    },

    exchangeRefreshTokenForAuthTokens: unusedOperation,
    searchAccounts: unusedOperation,
    getTrophySummary: unusedOperation,
  };

  const session = new PlayStationAuthorizationSession(
    () => currentNpsso,
    operations,
    new PlayStationRequestGate({
      minimumIntervalMs: 0,
    }),
    () => 1_000,
  );

  assert.deepEqual(await session.getAuthorization(), {
    accessToken: "first-access-token",
  });

  currentNpsso = "b".repeat(64);

  assert.deepEqual(await session.getAuthorization(), {
    accessToken: "second-access-token",
  });

  assert.deepEqual(usedNpssoValues, ["a".repeat(64), "b".repeat(64)]);
});
