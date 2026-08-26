import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createApp } from "../app.js";
import { openDatabase } from "../database/database.js";
import type { PlayStationApiOperations } from "../features/playstation/playStationApi.js";
import { PlayStationRequestGate } from "../features/playstation/playStationRequestGate.js";

async function closeServer(
  server: ReturnType<ReturnType<typeof createApp>["listen"]>,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) {
        resolve();
        return;
      }

      reject(error);
    });
  });
}

test("tests a dedicated reader without exposing credentials", async () => {
  const database = openDatabase(":memory:");
  const cacheDirectory = await mkdtemp(join(tmpdir(), "backlog-psn-"));
  const calls: string[] = [];

  const operations: PlayStationApiOperations = {
    async exchangeNpssoForAccessCode(npsso) {
      assert.equal(npsso, "n".repeat(64));
      calls.push("exchange-npsso");
      return "access-code";
    },

    async exchangeAccessCodeForAuthTokens(accessCode) {
      assert.equal(accessCode, "access-code");
      calls.push("exchange-code");

      return {
        accessToken: "access-token",
        expiresIn: 3_600,
        refreshToken: "refresh-token",
        refreshTokenExpiresIn: 7_200,
      };
    },
    async exchangeRefreshTokenForAuthTokens() {
      throw new Error("The fresh access token should be reused.");
    },

    async searchAccounts(authorization, onlineId) {
      assert.equal(authorization.accessToken, "access-token");
      calls.push(`search:${onlineId}`);

      return {
        domainResponses: [
          {
            results: [
              {
                socialMetadata: {
                  accountId: "20002",
                  onlineId,
                },
              },
            ],
          },
        ],
      };
    },

    async getTrophySummary(authorization, accountId) {
      assert.equal(authorization.accessToken, "access-token");
      calls.push(`summary:${accountId}`);

      return {
        accountId: accountId === "me" ? "10001" : accountId,
        trophyLevel: accountId === "me" ? 1 : 425,
        progress: 52,
        tier: accountId === "me" ? 1 : 5,
        earnedTrophies: {
          bronze: accountId === "me" ? 0 : 1_234,
          silver: accountId === "me" ? 0 : 456,
          gold: accountId === "me" ? 0 : 78,
          platinum: accountId === "me" ? 0 : 42,
        },
      };
    },

    async getTrophyTitles(authorization, accountId, options) {
      assert.equal(authorization.accessToken, "access-token");
      assert.equal(accountId, "20002");
      assert.deepEqual(options, { limit: 800, offset: 0 });

      calls.push(`titles:${accountId}`);

      return {
        trophyTitles: [
          {
            npServiceName: "trophy2",
            npCommunicationId: "NPWR00001_00",
            trophySetVersion: "01.00",
            trophyTitleName: "Example Game",
            trophyTitleIconUrl: "https://image.api.playstation.com/example.png",
            trophyTitlePlatform: "PS5",
            hasTrophyGroups: true,
            definedTrophies: {
              bronze: 40,
              silver: 10,
              gold: 3,
              platinum: 1,
            },
            progress: 50,
            earnedTrophies: {
              bronze: 20,
              silver: 5,
              gold: 1,
              platinum: 0,
            },
            hiddenFlag: false,
            lastUpdatedDateTime: "2026-08-25T12:00:00Z",
          },
        ],
        totalItemCount: 1,
      };
    },
  };

  const server = createApp(
    database,
    cacheDirectory,
    { clientId: null, clientSecret: null },
    fetch,
    {
      credentials: {
        readerNpsso: "n".repeat(64),
        readerOnlineId: "BacklogReader",
        targetOnlineId: "MainAccount",
      },
      operations,
      requestGate: new PlayStationRequestGate({
        minimumIntervalMs: 0,
      }),
    },
  ).listen(0, "127.0.0.1");

  try {
    await once(server, "listening");

    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const statusResponse = await fetch(
      `${baseUrl}/api/integrations/playstation/status`,
    );

    assert.deepEqual(await statusResponse.json(), {
      status: {
        configured: true,
        readerOnlineId: "BacklogReader",
        targetOnlineId: "MainAccount",
      },
    });

    assert.deepEqual(calls, []);

    const rejectedResponse = await fetch(
      `${baseUrl}/api/integrations/playstation/connection-tests`,
      { method: "POST" },
    );

    assert.equal(rejectedResponse.status, 400);
    assert.deepEqual(calls, []);

    const connectionResponse = await fetch(
      `${baseUrl}/api/integrations/playstation/connection-tests`,
      {
        method: "POST",
        headers: {
          "x-trophy-backlog-action": "test-playstation-connection",
        },
      },
    );

    assert.equal(connectionResponse.status, 200);

    const responseBody = await connectionResponse.json();
    const serializedBody = JSON.stringify(responseBody);

    assert.doesNotMatch(serializedBody, /access-token|refresh-token/);
    assert.doesNotMatch(serializedBody, new RegExp("n".repeat(64)));

    assert.deepEqual(responseBody, {
      connection: {
        reader: {
          accountId: "10001",
          onlineId: "BacklogReader",
        },
        target: {
          accountId: "20002",
          onlineId: "MainAccount",
        },
        targetTrophySummary: {
          trophyLevel: 425,
          progress: 52,
          tier: 5,
          earnedTrophies: {
            bronze: 1_234,
            silver: 456,
            gold: 78,
            platinum: 42,
          },
        },
        requestsMade: 5,
      },
    });

    assert.deepEqual(calls, [
      "exchange-npsso",
      "exchange-code",
      "summary:me",
      "search:MainAccount",
      "summary:20002",
    ]);

    const repeatedResponse = await fetch(
      `${baseUrl}/api/integrations/playstation/connection-tests`,
      {
        method: "POST",
        headers: {
          "x-trophy-backlog-action": "test-playstation-connection",
        },
      },
    );

    assert.equal(repeatedResponse.status, 200);

    const repeatedBody = (await repeatedResponse.json()) as {
      connection: { requestsMade: number };
    };

    assert.equal(repeatedBody.connection.requestsMade, 3);

    assert.deepEqual(calls, [
      "exchange-npsso",
      "exchange-code",
      "summary:me",
      "search:MainAccount",
      "summary:20002",
      "summary:me",
      "search:MainAccount",
      "summary:20002",
    ]);

    const rejectedPreviewResponse = await fetch(
      `${baseUrl}/api/integrations/playstation/title-previews`,
      { method: "POST" },
    );

    assert.equal(rejectedPreviewResponse.status, 400);

    const previewResponse = await fetch(
      `${baseUrl}/api/integrations/playstation/title-previews`,
      {
        method: "POST",
        headers: {
          "x-trophy-backlog-action": "preview-playstation-titles",
        },
      },
    );

    assert.equal(previewResponse.status, 200);

    const previewBody = (await previewResponse.json()) as {
      preview: {
        providerTitleCount: number;
        supportedTitleCount: number;
        excludedTitleCount: number;
        titles: Array<{
          name: string;
          platforms: string[];
        }>;
        requestsMade: number;
      };
    };

    assert.equal(previewBody.preview.providerTitleCount, 1);
    assert.equal(previewBody.preview.supportedTitleCount, 1);
    assert.equal(previewBody.preview.excludedTitleCount, 0);
    assert.equal(previewBody.preview.titles[0]?.name, "Example Game");
    assert.deepEqual(previewBody.preview.titles[0]?.platforms, ["PS5"]);
    assert.equal(previewBody.preview.requestsMade, 4);

    assert.deepEqual(calls.slice(-4), [
      "summary:me",
      "search:MainAccount",
      "summary:20002",
      "titles:20002",
    ]);
  } finally {
    await closeServer(server);
    database.close();

    await rm(cacheDirectory, {
      recursive: true,
      force: true,
    });
  }
});
