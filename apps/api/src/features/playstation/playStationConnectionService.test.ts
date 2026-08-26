import assert from "node:assert/strict";
import { test } from "node:test";
import type { PlayStationApiOperations } from "./playStationApi.js";
import { PlayStationConnectionService } from "./playStationConnectionService.js";
import { PlayStationRequestGate } from "./playStationRequestGate.js";

test("refuses matching reader and target account IDs", async () => {
  let targetSummaryRequested = false;

  const operations: PlayStationApiOperations = {
    async exchangeNpssoForAccessCode() {
      return "access-code";
    },
    async exchangeAccessCodeForAuthTokens() {
      return {
        accessToken: "access-token",
        expiresIn: 3_600,
        refreshToken: "refresh-token",
        refreshTokenExpiresIn: 7_200,
      };
    },
    async exchangeRefreshTokenForAuthTokens() {
      throw new Error("Refresh should not be required.");
    },
    async searchAccounts(_authorization, onlineId) {
      return {
        domainResponses: [
          {
            results: [
              {
                socialMetadata: {
                  accountId: "10001",
                  onlineId,
                },
              },
            ],
          },
        ],
      };
    },
    async getTrophySummary(_authorization, accountId) {
      if (accountId !== "me") {
        targetSummaryRequested = true;
      }

      return {
        accountId: "10001",
        trophyLevel: 1,
        progress: 0,
        tier: 1,
        earnedTrophies: {
          bronze: 0,
          silver: 0,
          gold: 0,
          platinum: 0,
        },
      };
    },
  };

  const service = new PlayStationConnectionService(
    {
      readerNpsso: "n".repeat(64),
      readerOnlineId: "ReaderAlias",
      targetOnlineId: "TargetAlias",
    },
    operations,
    new PlayStationRequestGate({ minimumIntervalMs: 0 }),
  );

  await assert.rejects(service.testConnection(), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /must be different/);
    return true;
  });

  assert.equal(targetSummaryRequested, false);
});
