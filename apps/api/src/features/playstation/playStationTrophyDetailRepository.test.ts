import assert from "node:assert/strict";
import type { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { openDatabase } from "../../database/database.js";
import { HttpError } from "../../errors/httpError.js";
import { PlayStationTrophyDetailRepository } from "./playStationTrophyDetailRepository.js";
import type {
  PlayStationTrophyDefinition,
  PlayStationTrophyDetailFetchResult,
  PlayStationTrophyEarning,
  PlayStationTrophyEarningsFetchResult,
  PlayStationTrophyTitlePreview,
} from "./playStationTypes.js";

const FIRST_SYNC = new Date("2026-08-27T12:00:00.000Z");
const SECOND_SYNC = new Date("2026-08-28T12:00:00.000Z");

function seedLinkedGame(database: DatabaseSync): void {
  const timestamp = FIRST_SYNC.toISOString();

  database
    .prepare(
      `
        INSERT INTO library_games (
          id,
          title,
          sort_title,
          platform,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      "stored-detail-game",
      "Stored Detail Game",
      "Stored Detail Game",
      "PS5",
      timestamp,
      timestamp,
    );

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
      "stored-detail-game",
      "NPWR77777_00",
      "trophy2",
      "Stored Detail Game",
      JSON.stringify(["PS5"]),
      "https://example.com/title.png",
      "manual_match",
      JSON.stringify({
        npCommunicationId: "NPWR77777_00",
      }),
      timestamp,
      timestamp,
      timestamp,
    );
}

function createTitle(
  version: string,
  includeDlc: boolean,
): PlayStationTrophyTitlePreview {
  return {
    npServiceName: "trophy2",
    npCommunicationId: "NPWR77777_00",
    trophySetVersion: version,
    name: "Stored Detail Game",
    detail: null,
    iconUrl: "https://example.com/title.png",
    platforms: ["PS5"],
    hasTrophyGroups: includeDlc,
    definedTrophies: {
      bronze: includeDlc ? 2 : 1,
      silver: 0,
      gold: 0,
      platinum: 0,
    },
    progress: 0,
    earnedTrophies: {
      bronze: 0,
      silver: 0,
      gold: 0,
      platinum: 0,
    },
    hidden: false,
    lastUpdatedAt: "2026-08-27T11:00:00Z",
  };
}

function createDefinition(
  trophyId: number,
  trophyGroupId: string,
): PlayStationTrophyDefinition {
  return {
    trophyId,
    trophyGroupId,
    trophyType: "bronze",
    hidden: false,
    name: `Trophy ${trophyId}`,
    detail: `Earn trophy ${trophyId}.`,
    iconUrl: `https://example.com/trophy-${trophyId}.png`,
    providerPayload: {
      trophyId,
      trophyGroupId,
      trophyType: "bronze",
    },
  };
}

function createEarning(
  trophyId: number,
  earned = false,
): PlayStationTrophyEarning {
  return {
    trophyId,
    trophyType: "bronze",
    hidden: false,
    earned,
    earnedAt: earned ? "2026-08-28T11:00:00Z" : null,
    rarity: 2,
    earnedRate: 25,
    progressTargetValue: "100",
    progressValue: earned ? "100" : "0",
    progressRate: earned ? 100 : 0,
    rewardName: null,
    rewardImageUrl: null,
    providerPayload: {
      trophyId,
      trophyType: "bronze",
      earned,
    },
  };
}

function createFullResult(
  version: string,
  includeDlc: boolean,
): PlayStationTrophyDetailFetchResult {
  const definitions = [
    createDefinition(0, "default"),
    ...(includeDlc ? [createDefinition(1, "001")] : []),
  ];

  const earnings = definitions.map((definition) =>
    createEarning(definition.trophyId),
  );

  return {
    trophySet: {
      trophySetVersion: version,
      titleName: "Stored Detail Game",
      titleDetail: "Stored locally.",
      titleIconUrl: "https://example.com/title.png",
      platforms: ["PS5"],
      hasTrophyGroups: includeDlc,
      definedTrophies: {
        bronze: includeDlc ? 2 : 1,
        silver: 0,
        gold: 0,
        platinum: 0,
      },
      groups: [
        {
          trophyGroupId: "default",
          name: "Stored Detail Game",
          detail: null,
          iconUrl: "https://example.com/default.png",
          definedTrophies: {
            bronze: 1,
            silver: 0,
            gold: 0,
            platinum: 0,
          },
          providerPayload: {
            trophyGroupId: "default",
          },
        },
        ...(includeDlc
          ? [
              {
                trophyGroupId: "001",
                name: "Additional Trophies",
                detail: null,
                iconUrl: "https://example.com/001.png",
                definedTrophies: {
                  bronze: 1,
                  silver: 0,
                  gold: 0,
                  platinum: 0,
                },
                providerPayload: {
                  trophyGroupId: "001",
                },
              },
            ]
          : []),
      ],
      providerPayload: {
        trophySetVersion: version,
      },
    },
    definitions,
    earnings,
    lastUpdatedAt: "2026-08-27T11:00:00Z",
    requestsMade: 3,
    retriesUsed: 0,
  };
}

test("replaces stale trophy definitions and reconstructs them locally", () => {
  const database = openDatabase(":memory:");
  let currentTime = FIRST_SYNC;

  try {
    seedLinkedGame(database);

    const repository = new PlayStationTrophyDetailRepository(
      database,
      () => currentTime,
    );

    const original = repository.storeFull(
      "stored-detail-game",
      "target-account",
      createTitle("01.00", true),
      createFullResult("01.00", true),
    );

    assert.equal(original.groups.length, 2);
    assert.equal(original.groups.flatMap((group) => group.trophies).length, 2);
    assert.equal(original.earningsAccountId, "target-account");

    const markedUnobtainable = repository.updateTrophyAvailability(
      "stored-detail-game",
      0,
      {
        unobtainable: true,
        reason: "Online servers closed.",
      },
    );

    assert.equal(
      markedUnobtainable?.groups[0]?.trophies[0]?.unobtainable,
      true,
    );
    assert.equal(
      markedUnobtainable?.groups[0]?.trophies[0]?.unobtainableReason,
      "Online servers closed.",
    );

    currentTime = SECOND_SYNC;

    const replaced = repository.storeFull(
      "stored-detail-game",
      "target-account",
      createTitle("02.00", false),
      createFullResult("02.00", false),
    );

    assert.equal(replaced.trophySetVersion, "02.00");
    assert.equal(replaced.groups.length, 1);
    assert.equal(replaced.groups[0]?.trophyGroupId, "default");
    assert.equal(replaced.groups[0]?.trophies.length, 1);
    assert.equal(replaced.groups[0]?.trophies[0]?.trophyId, 0);
    assert.equal(replaced.groups[0]?.trophies[0]?.unobtainable, true);
    assert.equal(
      replaced.groups[0]?.trophies[0]?.unobtainableReason,
      "Online servers closed.",
    );
    assert.equal(replaced.definitionsRefreshedAt, SECOND_SYNC.toISOString());

    const storedWithoutProviderRequest =
      repository.findByGameId("stored-detail-game");

    assert.deepEqual(storedWithoutProviderRequest, replaced);

    const availableAgain = repository.updateTrophyAvailability(
      "stored-detail-game",
      0,
      {
        unobtainable: false,
        reason: null,
      },
    );

    assert.equal(availableAgain?.groups[0]?.trophies[0]?.unobtainable, false);

    const staleGroupCount = database
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM playstation_trophy_groups
          WHERE game_id = ?
            AND trophy_group_id = '001'
        `,
      )
      .get("stored-detail-game") as unknown as {
      count: number;
    };

    const staleTrophyCount = database
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM playstation_trophies
          WHERE game_id = ?
            AND trophy_id = 1
        `,
      )
      .get("stored-detail-game") as unknown as {
      count: number;
    };

    assert.equal(staleGroupCount.count, 0);
    assert.equal(staleTrophyCount.count, 0);
  } finally {
    database.close();
  }
});

test("updates earnings without replacing stored definitions", () => {
  const database = openDatabase(":memory:");

  try {
    seedLinkedGame(database);

    const repository = new PlayStationTrophyDetailRepository(
      database,
      () => SECOND_SYNC,
    );

    repository.storeFull(
      "stored-detail-game",
      "target-account",
      createTitle("02.00", false),
      createFullResult("02.00", false),
    );

    const title = createTitle("02.00", false);
    title.progress = 100;
    title.earnedTrophies = {
      bronze: 1,
      silver: 0,
      gold: 0,
      platinum: 0,
    };
    title.lastUpdatedAt = "2026-08-28T11:00:00Z";

    const earningsResult: PlayStationTrophyEarningsFetchResult = {
      earnings: [createEarning(0, true)],
      lastUpdatedAt: "2026-08-28T11:00:00Z",
      requestsMade: 1,
      retriesUsed: 0,
    };

    const updated = repository.storeEarningsOnly(
      "stored-detail-game",
      "target-account",
      title,
      earningsResult,
    );

    const trophy = updated.groups[0]?.trophies[0];

    assert.equal(trophy?.name, "Trophy 0");
    assert.equal(trophy?.detail, "Earn trophy 0.");
    assert.equal(trophy?.earned, true);
    assert.equal(trophy?.earnedAt, "2026-08-28T11:00:00Z");
    assert.equal(trophy?.progressValue, "100");
    assert.equal(updated.earningsAccountId, "target-account");
    assert.equal(updated.lastObservedTitleUpdatedAt, "2026-08-28T11:00:00Z");
  } finally {
    database.close();
  }
});

test("rolls back an earnings refresh with unexpected trophy IDs", () => {
  const database = openDatabase(":memory:");

  try {
    seedLinkedGame(database);

    const repository = new PlayStationTrophyDetailRepository(
      database,
      () => SECOND_SYNC,
    );

    repository.storeFull(
      "stored-detail-game",
      "target-account",
      createTitle("02.00", false),
      createFullResult("02.00", false),
    );

    const invalidResult: PlayStationTrophyEarningsFetchResult = {
      earnings: [createEarning(99, true)],
      lastUpdatedAt: "2026-08-28T11:00:00Z",
      requestsMade: 1,
      retriesUsed: 0,
    };

    assert.throws(
      () =>
        repository.storeEarningsOnly(
          "stored-detail-game",
          "target-account",
          createTitle("02.00", false),
          invalidResult,
        ),
      (error: unknown) => {
        assert.ok(error instanceof HttpError);
        assert.equal(error.code, "playstation_trophy_details_inconsistent");
        return true;
      },
    );

    const stored = repository.findByGameId("stored-detail-game");

    assert.equal(stored?.groups[0]?.trophies[0]?.earned, false);
    assert.equal(stored?.lastObservedTitleUpdatedAt, "2026-08-27T11:00:00Z");
  } finally {
    database.close();
  }
});
