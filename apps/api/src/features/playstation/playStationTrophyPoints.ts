import type { PlayStationTrophyCounts } from "./playStationTypes.js";

export const playStationTrophyPointValues = {
  bronze: 15,
  silver: 30,
  gold: 90,
  platinum: 300,
} as const satisfies Readonly<Record<keyof PlayStationTrophyCounts, number>>;

interface TrophyLevelBand {
  startLevel: number;
  endLevel: number;
  pointsPerLevel: number;
}

const trophyLevelBands: readonly TrophyLevelBand[] = [
  { startLevel: 1, endLevel: 100, pointsPerLevel: 60 },
  { startLevel: 100, endLevel: 200, pointsPerLevel: 90 },
  { startLevel: 200, endLevel: 300, pointsPerLevel: 450 },
  { startLevel: 300, endLevel: 400, pointsPerLevel: 900 },
  { startLevel: 400, endLevel: 500, pointsPerLevel: 1_350 },
  { startLevel: 500, endLevel: 600, pointsPerLevel: 1_800 },
  { startLevel: 600, endLevel: 700, pointsPerLevel: 2_250 },
  { startLevel: 700, endLevel: 800, pointsPerLevel: 2_700 },
  { startLevel: 800, endLevel: 900, pointsPerLevel: 3_150 },
  { startLevel: 900, endLevel: 999, pointsPerLevel: 3_600 },
];

export const playStationMaximumLevelPoints = trophyLevelBands.reduce(
  (total, band) =>
    total + (band.endLevel - band.startLevel) * band.pointsPerLevel,
  0,
);

export interface PlayStationTrophyPointSummary {
  earnedPoints: number;
  totalPoints: number;
  remainingPoints: number;
}

export interface CalculatedPlayStationTrophyLevel {
  totalPoints: number;
  level: number;
  progressPercent: number;
  pointsInLevel: number;
  pointsForLevel: number;
  pointsToNextLevel: number;
  pointsToLevel999: number;
}

function assertCount(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field} must be a non-negative safe integer.`);
  }
}

function assertTrophyCounts(counts: PlayStationTrophyCounts): void {
  assertCount(counts.bronze, "bronze");
  assertCount(counts.silver, "silver");
  assertCount(counts.gold, "gold");
  assertCount(counts.platinum, "platinum");
}

export function calculateTrophyPoints(counts: PlayStationTrophyCounts): number {
  assertTrophyCounts(counts);

  const points =
    counts.bronze * playStationTrophyPointValues.bronze +
    counts.silver * playStationTrophyPointValues.silver +
    counts.gold * playStationTrophyPointValues.gold +
    counts.platinum * playStationTrophyPointValues.platinum;

  if (!Number.isSafeInteger(points)) {
    throw new RangeError("The calculated trophy points exceed safe storage.");
  }

  return points;
}

export function calculateTrophyPointSummary(
  earned: PlayStationTrophyCounts,
  total: PlayStationTrophyCounts,
): PlayStationTrophyPointSummary {
  assertTrophyCounts(earned);
  assertTrophyCounts(total);

  for (const type of Object.keys(playStationTrophyPointValues) as Array<
    keyof PlayStationTrophyCounts
  >) {
    if (earned[type] > total[type]) {
      throw new RangeError(
        `Earned ${type} trophies cannot exceed the defined total.`,
      );
    }
  }

  const earnedPoints = calculateTrophyPoints(earned);
  const totalPoints = calculateTrophyPoints(total);

  return {
    earnedPoints,
    totalPoints,
    remainingPoints: totalPoints - earnedPoints,
  };
}

export function calculatePlayStationTrophyLevel(
  counts: PlayStationTrophyCounts,
): CalculatedPlayStationTrophyLevel {
  const totalPoints = calculateTrophyPoints(counts);
  let remainingPoints = totalPoints;

  for (const band of trophyLevelBands) {
    const levelCount = band.endLevel - band.startLevel;
    const bandPoints = levelCount * band.pointsPerLevel;

    if (remainingPoints < bandPoints) {
      const levelsGained = Math.floor(remainingPoints / band.pointsPerLevel);
      const pointsInLevel =
        remainingPoints - levelsGained * band.pointsPerLevel;

      return {
        totalPoints,
        level: band.startLevel + levelsGained,
        progressPercent: Math.floor(
          (pointsInLevel / band.pointsPerLevel) * 100,
        ),
        pointsInLevel,
        pointsForLevel: band.pointsPerLevel,
        pointsToNextLevel: band.pointsPerLevel - pointsInLevel,
        pointsToLevel999: playStationMaximumLevelPoints - totalPoints,
      };
    }

    remainingPoints -= bandPoints;
  }

  return {
    totalPoints,
    level: 999,
    progressPercent: 100,
    pointsInLevel: 0,
    pointsForLevel: 0,
    pointsToNextLevel: 0,
    pointsToLevel999: 0,
  };
}
