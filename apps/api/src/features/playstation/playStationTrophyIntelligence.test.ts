import assert from "node:assert/strict";
import { test } from "node:test";
import { calculatePlayStationGameTrophyIntelligence } from "./playStationTrophyIntelligence.js";

test("calculates game points and reliable platinum and completion timing", () => {
  assert.deepEqual(
    calculatePlayStationGameTrophyIntelligence([
      {
        trophyType: "bronze",
        earned: true,
        earnedAt: "2020-01-01T00:00:00.000Z",
      },
      {
        trophyType: "silver",
        earned: true,
        earnedAt: "2020-01-02T12:00:00.000Z",
      },
      {
        trophyType: "gold",
        earned: true,
        earnedAt: "2020-01-03T00:00:00.000Z",
      },
      {
        trophyType: "platinum",
        earned: true,
        earnedAt: "2020-01-03T00:00:10.000Z",
      },
    ]),
    {
      counts: {
        earned: {
          bronze: 1,
          silver: 1,
          gold: 1,
          platinum: 1,
        },
        total: {
          bronze: 1,
          silver: 1,
          gold: 1,
          platinum: 1,
        },
      },
      points: {
        earnedPoints: 435,
        totalPoints: 435,
        remainingPoints: 0,
      },
      timing: {
        firstTrophy: {
          earnedAt: "2020-01-01T00:00:00.000Z",
          unavailableReason: null,
        },
        platinum: {
          earnedAt: "2020-01-03T00:00:10.000Z",
          elapsedSinceFirstTrophyMilliseconds: 172_810_000,
          unavailableReason: null,
        },
        completion: {
          earnedAt: "2020-01-03T00:00:10.000Z",
          elapsedSinceFirstTrophyMilliseconds: 172_810_000,
          unavailableReason: null,
        },
      },
    },
  );
});

test("separates platinum completion from incomplete DLC", () => {
  const result = calculatePlayStationGameTrophyIntelligence([
    {
      trophyType: "bronze",
      earned: true,
      earnedAt: "2020-01-01T00:00:00.000Z",
    },
    {
      trophyType: "platinum",
      earned: true,
      earnedAt: "2020-01-02T00:00:00.000Z",
    },
    {
      trophyType: "bronze",
      earned: false,
      earnedAt: null,
    },
  ]);

  assert.deepEqual(result.points, {
    earnedPoints: 315,
    totalPoints: 330,
    remainingPoints: 15,
  });
  assert.deepEqual(result.timing.platinum, {
    earnedAt: "2020-01-02T00:00:00.000Z",
    elapsedSinceFirstTrophyMilliseconds: 86_400_000,
    unavailableReason: null,
  });
  assert.deepEqual(result.timing.completion, {
    earnedAt: null,
    elapsedSinceFirstTrophyMilliseconds: null,
    unavailableReason: "not_earned",
  });
});

test("withholds first and completion durations when earned timestamps are missing", () => {
  const result = calculatePlayStationGameTrophyIntelligence([
    {
      trophyType: "bronze",
      earned: true,
      earnedAt: null,
    },
    {
      trophyType: "gold",
      earned: true,
      earnedAt: "2020-01-02T00:00:00.000Z",
    },
    {
      trophyType: "platinum",
      earned: true,
      earnedAt: "2020-01-03T00:00:00.000Z",
    },
  ]);

  assert.deepEqual(result.timing.firstTrophy, {
    earnedAt: null,
    unavailableReason: "missing_timestamps",
  });
  assert.deepEqual(result.timing.platinum, {
    earnedAt: "2020-01-03T00:00:00.000Z",
    elapsedSinceFirstTrophyMilliseconds: null,
    unavailableReason: "first_trophy_timestamp_missing",
  });
  assert.deepEqual(result.timing.completion, {
    earnedAt: null,
    elapsedSinceFirstTrophyMilliseconds: null,
    unavailableReason: "missing_timestamps",
  });
});

test("reports unearned and platinum-free timing states explicitly", () => {
  const result = calculatePlayStationGameTrophyIntelligence([
    {
      trophyType: "bronze",
      earned: false,
      earnedAt: null,
    },
  ]);

  assert.deepEqual(result.timing, {
    firstTrophy: {
      earnedAt: null,
      unavailableReason: "not_earned",
    },
    platinum: {
      earnedAt: null,
      elapsedSinceFirstTrophyMilliseconds: null,
      unavailableReason: "not_applicable",
    },
    completion: {
      earnedAt: null,
      elapsedSinceFirstTrophyMilliseconds: null,
      unavailableReason: "not_earned",
    },
  });
});
