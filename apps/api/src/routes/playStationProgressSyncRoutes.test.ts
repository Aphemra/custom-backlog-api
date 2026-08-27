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
import type {
  PlayStationApiOperations,
  PlayStationTrophyDetailApiOperations,
} from "../features/playstation/playStationApi.js";
import { PlayStationRequestGate } from "../features/playstation/playStationRequestGate.js";

const pngBytes = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);

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

function createDetailOperations(): PlayStationTrophyDetailApiOperations {
  const trophyTypes = [
    ...Array.from({ length: 40 }, () => "bronze" as const),
    ...Array.from({ length: 10 }, () => "silver" as const),
    ...Array.from({ length: 3 }, () => "gold" as const),
    "platinum" as const,
  ];

  return {
    async getTrophyGroups(_authorization, npCommunicationId, options) {
      assert.equal(npCommunicationId, "NPWR50000_00");
      assert.equal(options.npServiceName, "trophy2");

      return {
        trophySetVersion: "01.00",
        trophyTitleName: "Linked Provider Game",
        trophyTitleIconUrl: "https://image.api.playstation.com/linked.png",
        trophyTitlePlatform: "PS5",
        definedTrophies: {
          bronze: 40,
          silver: 10,
          gold: 3,
          platinum: 1,
        },
        trophyGroups: [
          {
            trophyGroupId: "default",
            trophyGroupName: "Linked Provider Game",
            trophyGroupIconUrl: "https://image.api.playstation.com/linked.png",
            definedTrophies: {
              bronze: 39,
              silver: 10,
              gold: 3,
              platinum: 1,
            },
          },
          {
            trophyGroupId: "001",
            trophyGroupName: "Additional Trophies",
            trophyGroupIconUrl: "https://image.api.playstation.com/linked.png",
            definedTrophies: {
              bronze: 1,
              silver: 0,
              gold: 0,
              platinum: 0,
            },
          },
        ],
      };
    },

    async getTrophyDefinitions(
      _authorization,
      npCommunicationId,
      trophyGroupId,
      options,
    ) {
      assert.equal(npCommunicationId, "NPWR50000_00");
      assert.equal(trophyGroupId, "all");
      assert.equal(options.offset, 0);
      assert.equal(options.limit, 500);

      return {
        trophySetVersion: "01.00",
        hasTrophyGroups: true,
        trophies: trophyTypes.map((trophyType, trophyId) => ({
          trophyId,
          trophyHidden: false,
          trophyType,
          trophyName: `Trophy ${trophyId}`,
          trophyDetail: `Earn trophy ${trophyId}.`,
          trophyIconUrl: "https://image.api.playstation.com/linked.png",
          trophyGroupId: trophyId === 0 ? "001" : "default",
        })),
        totalItemCount: trophyTypes.length,
      };
    },

    async getTrophyEarnings(
      _authorization,
      accountId,
      npCommunicationId,
      trophyGroupId,
      options,
    ) {
      assert.equal(accountId, "20002");
      assert.equal(npCommunicationId, "NPWR50000_00");
      assert.equal(trophyGroupId, "all");
      assert.equal(options.offset, 0);
      assert.equal(options.limit, 500);

      return {
        trophySetVersion: "01.00",
        hasTrophyGroups: true,
        lastUpdatedDateTime: "2026-08-27T12:00:00.000Z",
        trophies: trophyTypes.map((trophyType, trophyId) => ({
          trophyId,
          trophyHidden: false,
          earned: true,
          earnedDateTime: "2026-08-27T12:00:00.000Z",
          trophyType,
          trophyRare: 2,
          trophyEarnedRate: "25.00",
        })),
        totalItemCount: trophyTypes.length,
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
    async () =>
      new Response(pngBytes, {
        status: 200,
        headers: {
          "content-type": "image/png",
          etag: '"linked-v1"',
        },
      }),
    {
      credentials: {
        readerNpsso: "n".repeat(64),
        readerOnlineId: "BacklogReader",
        targetOnlineId: "MainAccount",
      },
      operations: createOperations(),
      detailOperations: createDetailOperations(),
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
      detailSynchronization: {
        fullRefreshCount: number;
        earningsOnlyRefreshCount: number;
        unchangedCount: number;
        requestsMade: number;
        retriesUsed: number;
        artworkReferenceCount: number;
        uniqueArtworkImageCount: number;
        artworkAttachedCount: number;
        artworkFailedCount: number;
        artworkDownloadedCount: number;
        artworkNotModifiedCount: number;
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

    assert.deepEqual(responseBody.detailSynchronization, {
      fullRefreshCount: 1,
      earningsOnlyRefreshCount: 0,
      unchangedCount: 0,
      requestsMade: 3,
      retriesUsed: 0,
      artworkReferenceCount: 57,
      uniqueArtworkImageCount: 1,
      artworkAttachedCount: 57,
      artworkFailedCount: 0,
      artworkDownloadedCount: 1,
      artworkNotModifiedCount: 0,
    });

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

    const profileProgressionResponse = await fetch(
      `${baseUrl}/api/integrations/playstation/profile-progression`,
    );

    assert.equal(profileProgressionResponse.status, 200);

    const profileProgressionBody =
      (await profileProgressionResponse.json()) as {
        progression: {
          accountId: string;
          server: {
            level: number;
            progressPercent: number;
          };
          points: {
            total: number;
            toNextLevel: number;
            toLevel999: number;
          };
          calculation: {
            levelMatchesServer: boolean;
            progressMatchesServer: boolean;
          };
        };
      };

    assert.equal(profileProgressionBody.progression.accountId, "20002");
    assert.equal(profileProgressionBody.progression.server.level, 425);
    assert.equal(profileProgressionBody.progression.server.progressPercent, 52);
    assert.equal(profileProgressionBody.progression.points.total, 51_810);
    assert.equal(profileProgressionBody.progression.points.toNextLevel, 30);
    assert.equal(
      profileProgressionBody.progression.points.toLevel999,
      1_579_530,
    );
    assert.equal(
      profileProgressionBody.progression.calculation.levelMatchesServer,
      false,
    );
    assert.equal(
      profileProgressionBody.progression.calculation.progressMatchesServer,
      false,
    );

    const trophySetResponse = await fetch(
      `${baseUrl}/api/integrations/playstation/games/${linkedGame.id}/trophies`,
    );

    assert.equal(trophySetResponse.status, 200);

    const trophyAvailabilityResponse = await fetch(
      `${baseUrl}/api/integrations/playstation/games/${linkedGame.id}/trophies/0/availability`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          unobtainable: true,
          reason: "Server-dependent trophy.",
        }),
      },
    );

    assert.equal(trophyAvailabilityResponse.status, 200);

    const trophyAvailabilityBody =
      (await trophyAvailabilityResponse.json()) as {
        trophySet: {
          groups: Array<{
            trophies: Array<{
              trophyId: number;
              unobtainable: boolean;
              unobtainableReason: string | null;
            }>;
          }>;
        };
      };

    const markedTrophy = trophyAvailabilityBody.trophySet.groups
      .flatMap((group) => group.trophies)
      .find((trophy) => trophy.trophyId === 0);

    assert.deepEqual(markedTrophy, {
      ...markedTrophy,
      trophyId: 0,
      unobtainable: true,
      unobtainableReason: "Server-dependent trophy.",
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
          (SELECT COUNT(*) FROM cached_images) AS cached_image_count,
          (
            SELECT COUNT(*)
            FROM playstation_trophy_sets
          ) AS trophy_set_count,
          (
            SELECT COUNT(*)
            FROM playstation_trophy_groups
          ) AS trophy_group_count,
          (
            SELECT COUNT(*)
            FROM playstation_trophies
          ) AS trophy_count
      `,
      )
      .get() as unknown as {
      game_count: number;
      profile_snapshot_count: number;
      cached_image_count: number;
      trophy_set_count: number;
      trophy_group_count: number;
      trophy_count: number;
    };

    assert.deepEqual(
      { ...storedCounts },
      {
        game_count: 2,
        profile_snapshot_count: 1,
        cached_image_count: 1,
        trophy_set_count: 1,
        trophy_group_count: 2,
        trophy_count: 54,
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
