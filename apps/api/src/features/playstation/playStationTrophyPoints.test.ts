import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculatePlayStationTrophyLevel,
  calculateTrophyPoints,
  calculateTrophyPointSummary,
} from "./playStationTrophyPoints.js";

test("calculates canonical points for every trophy grade", () => {
  assert.equal(
    calculateTrophyPoints({
      bronze: 1,
      silver: 1,
      gold: 1,
      platinum: 1,
    }),
    435,
  );
});

test("calculates earned, available, and remaining game points", () => {
  assert.deepEqual(
    calculateTrophyPointSummary(
      {
        bronze: 10,
        silver: 2,
        gold: 1,
        platinum: 0,
      },
      {
        bronze: 20,
        silver: 5,
        gold: 3,
        platinum: 1,
      },
    ),
    {
      earnedPoints: 300,
      totalPoints: 1_020,
      remainingPoints: 720,
    },
  );
});

test("matches the reader profile level and progress returned by PSN", () => {
  assert.deepEqual(
    calculatePlayStationTrophyLevel({
      bronze: 3_367,
      silver: 1_147,
      gold: 380,
      platinum: 92,
    }),
    {
      totalPoints: 146_715,
      level: 396,
      progressPercent: 41,
      pointsInLevel: 375,
      pointsForLevel: 900,
      pointsToNextLevel: 525,
      pointsToLevel999: 1_484_625,
    },
  );
});

test("moves cleanly across level-band boundaries", () => {
  assert.deepEqual(
    calculatePlayStationTrophyLevel({
      bronze: 396,
      silver: 0,
      gold: 0,
      platinum: 0,
    }),
    {
      totalPoints: 5_940,
      level: 100,
      progressPercent: 0,
      pointsInLevel: 0,
      pointsForLevel: 90,
      pointsToNextLevel: 90,
      pointsToLevel999: 1_625_400,
    },
  );

  assert.deepEqual(
    calculatePlayStationTrophyLevel({
      bronze: 996,
      silver: 0,
      gold: 0,
      platinum: 0,
    }),
    {
      totalPoints: 14_940,
      level: 200,
      progressPercent: 0,
      pointsInLevel: 0,
      pointsForLevel: 450,
      pointsToNextLevel: 450,
      pointsToLevel999: 1_616_400,
    },
  );
});

test("caps calculated progression at level 999", () => {
  assert.deepEqual(
    calculatePlayStationTrophyLevel({
      bronze: 109_000,
      silver: 0,
      gold: 0,
      platinum: 0,
    }),
    {
      totalPoints: 1_635_000,
      level: 999,
      progressPercent: 100,
      pointsInLevel: 0,
      pointsForLevel: 0,
      pointsToNextLevel: 0,
      pointsToLevel999: 0,
    },
  );
});

test("rejects impossible trophy counts and summaries", () => {
  assert.throws(
    () =>
      calculateTrophyPoints({
        bronze: -1,
        silver: 0,
        gold: 0,
        platinum: 0,
      }),
    /bronze must be a non-negative safe integer/,
  );

  assert.throws(
    () =>
      calculateTrophyPointSummary(
        {
          bronze: 2,
          silver: 0,
          gold: 0,
          platinum: 0,
        },
        {
          bronze: 1,
          silver: 0,
          gold: 0,
          platinum: 0,
        },
      ),
    /Earned bronze trophies cannot exceed the defined total/,
  );
});
