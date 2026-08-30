import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateLibraryTrophyAvailability } from "./libraryTrophyAvailability.js";

test("calculates attainable trophy and point progress", () => {
  const result = calculateLibraryTrophyAvailability(
    {
      bronze: 34,
      silver: 20,
      gold: 1,
      platinum: 0,
    },
    {
      bronze: 35,
      silver: 28,
      gold: 1,
      platinum: 1,
    },
    {
      bronze: 1,
      silver: 2,
      gold: 0,
      platinum: 0,
    },
  );

  assert.deepEqual(result, {
    attainableTrophies: {
      bronze: 34,
      silver: 26,
      gold: 1,
      platinum: 1,
    },
    unobtainableTrophies: {
      bronze: 1,
      silver: 2,
      gold: 0,
      platinum: 0,
    },
    attainablePoints: 1_680,
    unobtainablePoints: 75,
    attainableProgressPercent: 86,
    earnedProgressSharePercent: 82.4742,
    unobtainableProgressSharePercent: 5.1546,
    isMaxAttainable: false,
  });
});

test("detects maximum attainable completion", () => {
  const result = calculateLibraryTrophyAvailability(
    {
      bronze: 34,
      silver: 26,
      gold: 1,
      platinum: 1,
    },
    {
      bronze: 35,
      silver: 28,
      gold: 1,
      platinum: 1,
    },
    {
      bronze: 1,
      silver: 2,
      gold: 0,
      platinum: 0,
    },
  );

  assert.equal(result.attainableProgressPercent, 100);
  assert.equal(result.isMaxAttainable, true);
  assert.equal(result.attainablePoints, 1_680);
  assert.equal(result.unobtainablePoints, 75);
});
