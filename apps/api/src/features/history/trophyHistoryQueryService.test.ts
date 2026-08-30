import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  EarnedTrophyHistoryRecord,
  TrophyHistoryLogQuery,
  TrophyHistoryResult,
} from "./historyTypes.js";
import { createTrophyHistoryQueryService } from "./trophyHistoryQueryService.js";
import { buildTrophyProgressionTimeline } from "./trophyProgressionTimeline.js";

function record(
  gameId: string,
  gameTitle: string,
  platform: "PS3" | "PS4" | "PS5",
  trophyId: number,
  trophyType: EarnedTrophyHistoryRecord["trophyType"],
  trophyName: string,
  earnedAt: string,
  isSecret = false,
): EarnedTrophyHistoryRecord {
  return {
    gameId,
    gameTitle,
    platform,
    trophyId,
    trophyGroupId: "default",
    trophyName,
    trophyDetail: null,
    trophyType,
    isSecret,
    earnedAt,
    trophyIconImageId: null,
    gameArtworkImageId: null,
  };
}

const history: TrophyHistoryResult = {
  timeline: buildTrophyProgressionTimeline([
    record(
      "assassins-creed-ps4",
      "Assassin's Creed® Origins",
      "PS4",
      1,
      "bronze",
      "First Steps",
      "2020-01-01T00:00:00.000Z",
    ),
    record(
      "astro-bot",
      "ASTRO BOT",
      "PS5",
      2,
      "gold",
      "Going Loco",
      "2021-01-01T00:00:00.000Z",
    ),
    record(
      "assassins-creed-ps5",
      "Assassin's Creed® Shadows",
      "PS5",
      3,
      "platinum",
      "Master Assassin",
      "2022-01-01T00:00:00.000Z",
    ),
    record(
      "persona-5",
      "Persona 5",
      "PS5",
      4,
      "bronze",
      "A Secret Trophy",
      "2023-01-01T00:00:00.000Z",
      true,
    ),
  ]),
  coverage: {
    latestProfileSnapshot: null,
    locallyStoredEarnedTrophies: {
      bronze: 2,
      silver: 0,
      gold: 1,
      platinum: 1,
    },
    timestampedEarnedTrophies: {
      bronze: 2,
      silver: 0,
      gold: 1,
      platinum: 1,
    },
    missingEarnedTrophyTimestamps: {
      bronze: 0,
      silver: 0,
      gold: 0,
      platinum: 0,
    },
    missingFromLocalCache: null,
    missingFromTimeline: null,
    excessInLocalCache: null,
    isComplete: null,
  },
};

function query(
  overrides: Partial<TrophyHistoryLogQuery> = {},
): TrophyHistoryLogQuery {
  return {
    search: null,
    platform: null,
    trophyType: null,
    gameId: null,
    earnedFrom: null,
    earnedTo: null,
    direction: "desc",
    page: 1,
    pageSize: 50,
    ...overrides,
  };
}

test("filters trophy history with symbol-insensitive tokenized search", () => {
  const service = createTrophyHistoryQueryService(history);

  const result = service.listTrophies(
    query({
      search: "assassins creed",
      platform: "PS5",
      trophyType: "platinum",
    }),
  );

  assert.equal(result.pagination.totalItems, 1);
  assert.equal(result.trophies[0]?.gameId, "assassins-creed-ps5");
});

test("paginates trophy history in descending chronological order", () => {
  const service = createTrophyHistoryQueryService(history);

  const firstPage = service.listTrophies(
    query({
      page: 1,
      pageSize: 2,
    }),
  );
  const secondPage = service.listTrophies(
    query({
      page: 2,
      pageSize: 2,
    }),
  );

  assert.deepEqual(
    firstPage.trophies.map((entry) => entry.trophyId),
    [4, 3],
  );
  assert.deepEqual(
    secondPage.trophies.map((entry) => entry.trophyId),
    [2, 1],
  );
  assert.deepEqual(firstPage.pagination, {
    page: 1,
    pageSize: 2,
    totalItems: 4,
    totalPages: 2,
  });
});

test("filters reconstructed milestones without rarity data", () => {
  const service = createTrophyHistoryQueryService(history);

  const result = service.listMilestones({
    kind: "platinum_total",
    direction: "desc",
  });

  assert.equal(result.milestones.length, 1);
  assert.equal(result.milestones[0]?.kind, "platinum_total");
  assert.equal(result.milestones[0]?.value, 1);
});

test("calculates platform, trophy-grade, and monthly history statistics", () => {
  const service = createTrophyHistoryQueryService(history);

  assert.deepEqual(service.getStatistics(), {
    gamesRepresented: 4,
    activeMonths: 4,
    byPlatform: [
      {
        platform: "PS3",
        trophyCount: 0,
        points: 0,
      },
      {
        platform: "PS4",
        trophyCount: 1,
        points: 15,
      },
      {
        platform: "PS5",
        trophyCount: 3,
        points: 405,
      },
    ],
    byTrophyType: [
      {
        trophyType: "bronze",
        trophyCount: 2,
        points: 30,
      },
      {
        trophyType: "silver",
        trophyCount: 0,
        points: 0,
      },
      {
        trophyType: "gold",
        trophyCount: 1,
        points: 90,
      },
      {
        trophyType: "platinum",
        trophyCount: 1,
        points: 300,
      },
    ],
    monthlyActivity: [
      {
        month: "2020-01",
        trophyCount: 1,
        points: 15,
      },
      {
        month: "2021-01",
        trophyCount: 1,
        points: 90,
      },
      {
        month: "2022-01",
        trophyCount: 1,
        points: 300,
      },
      {
        month: "2023-01",
        trophyCount: 1,
        points: 15,
      },
    ],
  });
});
