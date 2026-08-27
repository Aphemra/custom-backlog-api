import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { createApp } from "../app.js";
import { openDatabase } from "../database/database.js";
import { LibraryGameRepository } from "../features/library/libraryGameRepository.js";
import type { PlayStationApiOperations } from "../features/playstation/playStationApi.js";
import { PlayStationRequestGate } from "../features/playstation/playStationRequestGate.js";

interface CountRow {
  count: number;
}

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

function insertLink(database: DatabaseSync, gameId: string): void {
  const timestamp = "2026-08-27T12:00:00.000Z";

  database
    .prepare(
      `
      INSERT INTO playstation_game_links (
        game_id,
        np_communication_id,
        np_service_name,
        psn_title_name,
        platforms_json,
        icon_url,
        link_source,
        payload_json,
        linked_at,
        first_seen_at,
        last_seen_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      gameId,
      "NPWR50000_00",
      "trophy2",
      "Linked Provider Game",
      JSON.stringify(["PS5"]),
      "https://image.api.playstation.com/linked.png",
      "manual_match",
      JSON.stringify({}),
      timestamp,
      timestamp,
      timestamp,
    );
}

function createOperations(): PlayStationApiOperations {
  return {
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
      throw new Error("The cached access token should still be valid.");
    },

    async searchAccounts(_authorization, onlineId) {
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

    async getTrophySummary(_authorization, accountId) {
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

    async getTrophyTitles(_authorization, accountId, options) {
      assert.equal(accountId, "20002");
      assert.deepEqual(options, {
        limit: 800,
        offset: 0,
      });

      return {
        trophyTitles: [
          {
            npServiceName: "trophy2",
            npCommunicationId: "NPWR50000_00",
            trophySetVersion: "01.00",
            trophyTitleName: "Linked Provider Game",
            trophyTitleIconUrl: "https://image.api.playstation.com/linked.png",
            trophyTitlePlatform: "PS5",
            hasTrophyGroups: true,
            definedTrophies: {
              bronze: 40,
              silver: 10,
              gold: 3,
              platinum: 1,
            },
            progress: 100,
            earnedTrophies: {
              bronze: 40,
              silver: 10,
              gold: 3,
              platinum: 1,
            },
            hiddenFlag: false,
            lastUpdatedDateTime: "2026-08-27T12:00:00.000Z",
          },
          {
            npServiceName: "trophy2",
            npCommunicationId: "NPWR99999_00",
            trophySetVersion: "01.00",
            trophyTitleName: "Unlinked Provider Game",
            trophyTitleIconUrl:
              "https://image.api.playstation.com/unlinked.png",
            trophyTitlePlatform: "PS5",
            hasTrophyGroups: true,
            definedTrophies: {
              bronze: 20,
              silver: 5,
              gold: 1,
              platinum: 1,
            },
            progress: 50,
            earnedTrophies: {
              bronze: 10,
              silver: 2,
              gold: 0,
              platinum: 0,
            },
            hiddenFlag: false,
            lastUpdatedDateTime: "2026-08-27T12:00:00.000Z",
          },
        ],
        totalItemCount: 2,
      };
    },
  };
}

test("synchronizes only linked Library games without returning import data", async () => {
  const database = openDatabase(":memory:");
  const cacheDirectory = await mkdtemp(
    join(tmpdir(), "backlog-progress-sync-"),
  );
  const library = new LibraryGameRepository(database);

  const linkedGame = library.create({
    title: "Different Local Title",
    platform: "PS5",
    playStatus: "not_started",
    notes: null,
  });

  const unlinkedGame = library.create({
    title: "Unlinked Provider Game",
    platform: "PS5",
    playStatus: "not_started",
    notes: null,
  });

  insertLink(database, linkedGame.id);

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
      operations: createOperations(),
      requestGate: new PlayStationRequestGate({
        minimumIntervalMs: 0,
      }),
    },
  ).listen(0, "127.0.0.1");

  try {
    await once(server, "listening");

    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const rejectedResponse = await fetch(
      `${baseUrl}/api/integrations/playstation/progress-syncs`,
      {
        method: "POST",
      },
    );

    assert.equal(rejectedResponse.status, 400);

    const response = await fetch(
      `${baseUrl}/api/integrations/playstation/progress-syncs`,
      {
        method: "POST",
        headers: {
          "x-trophy-backlog-action": "synchronize-playstation-trophy-progress",
        },
      },
    );

    assert.equal(response.status, 200);

    const responseBody = (await response.json()) as {
      synchronization: {
        status: string;
        expectedTitleCount: number;
        processedTitleCount: number;
        snapshotsCreated: number;
        newTrophyAlertsCreated: number;
        completionLostAlertsCreated: number;
        profileSnapshot: {
          accountId: string;
          trophyLevel: number;
          levelProgressPercent: number;
          tier: number;
        };
      };
      selection: {
        providerTitleCount: number;
        supportedTitleCount: number;
        excludedTitleCount: number;
        linkedTitleCount: number;
      };
      preview?: unknown;
    };

    assert.equal(Object.hasOwn(responseBody, "preview"), false);

    assert.deepEqual(responseBody.selection, {
      providerTitleCount: 2,
      supportedTitleCount: 2,
      excludedTitleCount: 0,
      linkedTitleCount: 1,
    });

    assert.equal(responseBody.synchronization.status, "succeeded");
    assert.equal(responseBody.synchronization.expectedTitleCount, 1);
    assert.equal(responseBody.synchronization.processedTitleCount, 1);
    assert.equal(responseBody.synchronization.snapshotsCreated, 1);
    assert.equal(responseBody.synchronization.newTrophyAlertsCreated, 0);
    assert.equal(responseBody.synchronization.completionLostAlertsCreated, 0);

    assert.deepEqual(responseBody.synchronization.profileSnapshot, {
      ...responseBody.synchronization.profileSnapshot,
      accountId: "20002",
      trophyLevel: 425,
      levelProgressPercent: 52,
      tier: 5,
    });

    assert.equal(library.findById(linkedGame.id)?.playStatus, "completed");
    assert.equal(library.findById(unlinkedGame.id)?.playStatus, "not_started");

    const storedSnapshots = database
      .prepare(
        `
        SELECT
          game_id,
          progress_percent,
          is_100_percent
        FROM trophy_snapshots
      `,
      )
      .all() as unknown as Array<{
      game_id: string;
      progress_percent: number;
      is_100_percent: number;
    }>;

    assert.deepEqual(
      storedSnapshots.map((row) => ({ ...row })),
      [
        {
          game_id: linkedGame.id,
          progress_percent: 100,
          is_100_percent: 1,
        },
      ],
    );

    const storedCounts = database
      .prepare(
        `
        SELECT
          (SELECT COUNT(*) FROM library_games) AS game_count,
          (
            SELECT COUNT(*)
            FROM playstation_profile_snapshots
          ) AS profile_snapshot_count,
          (SELECT COUNT(*) FROM cached_images) AS cached_image_count
      `,
      )
      .get() as unknown as {
      game_count: number;
      profile_snapshot_count: number;
      cached_image_count: number;
    };

    assert.deepEqual(
      { ...storedCounts },
      {
        game_count: 2,
        profile_snapshot_count: 1,
        cached_image_count: 0,
      },
    );
  } finally {
    await closeServer(server);
    database.close();

    await rm(cacheDirectory, {
      recursive: true,
      force: true,
    });
  }
});
