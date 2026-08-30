import { calculateTrophyPoints } from "../playstation/playStationTrophyPoints.js";
import type {
  LibraryTrophyAvailabilitySummary,
  LibraryTrophyCounts,
} from "./libraryGameTypes.js";

const trophyTypes = [
  "bronze",
  "silver",
  "gold",
  "platinum",
] as const satisfies readonly (keyof LibraryTrophyCounts)[];

function totalTrophies(counts: LibraryTrophyCounts): number {
  return trophyTypes.reduce((total, type) => total + counts[type], 0);
}

function completionPoints(counts: LibraryTrophyCounts): number {
  return calculateTrophyPoints({
    ...counts,
    platinum: 0,
  });
}

function boundedTrackPercent(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }

  return Number(
    Math.min(100, Math.max(0, (numerator / denominator) * 100)).toFixed(4),
  );
}

export function calculateLibraryTrophyAvailability(
  earnedTrophies: LibraryTrophyCounts,
  totalTrophiesByGrade: LibraryTrophyCounts,
  unearnedUnobtainableTrophies: LibraryTrophyCounts,
): LibraryTrophyAvailabilitySummary {
  const unobtainableTrophies = Object.fromEntries(
    trophyTypes.map((type) => [
      type,
      Math.min(
        totalTrophiesByGrade[type],
        Math.max(0, unearnedUnobtainableTrophies[type]),
      ),
    ]),
  ) as unknown as LibraryTrophyCounts;

  const attainableTrophies = Object.fromEntries(
    trophyTypes.map((type) => [
      type,
      Math.max(
        earnedTrophies[type],
        totalTrophiesByGrade[type] - unobtainableTrophies[type],
      ),
    ]),
  ) as unknown as LibraryTrophyCounts;

  const hasUnobtainableTrophies = totalTrophies(unobtainableTrophies) > 0;

  const isMaxAttainable =
    hasUnobtainableTrophies &&
    trophyTypes.every(
      (type) => earnedTrophies[type] >= attainableTrophies[type],
    );

  const totalCompletionPoints = completionPoints(totalTrophiesByGrade);
  const earnedCompletionPoints = completionPoints(earnedTrophies);
  const unobtainableCompletionPoints = completionPoints(unobtainableTrophies);
  const attainableCompletionPoints = Math.max(
    0,
    totalCompletionPoints - unobtainableCompletionPoints,
  );

  const useTrophyCountsAsProgressWeight = totalCompletionPoints === 0;

  const totalProgressWeight = useTrophyCountsAsProgressWeight
    ? totalTrophies(totalTrophiesByGrade)
    : totalCompletionPoints;

  const earnedProgressWeight = useTrophyCountsAsProgressWeight
    ? totalTrophies(earnedTrophies)
    : earnedCompletionPoints;

  const unobtainableProgressWeight = useTrophyCountsAsProgressWeight
    ? totalTrophies(unobtainableTrophies)
    : unobtainableCompletionPoints;

  const attainableProgressWeight = useTrophyCountsAsProgressWeight
    ? totalTrophies(attainableTrophies)
    : attainableCompletionPoints;

  const attainableProgressPercent =
    attainableProgressWeight === 0
      ? isMaxAttainable
        ? 100
        : 0
      : Math.floor(
          Math.min(
            100,
            (earnedProgressWeight / attainableProgressWeight) * 100,
          ),
        );

  return {
    attainableTrophies,
    unobtainableTrophies,
    attainablePoints: calculateTrophyPoints(attainableTrophies),
    unobtainablePoints: calculateTrophyPoints(unobtainableTrophies),
    attainableProgressPercent,
    earnedProgressSharePercent: boundedTrackPercent(
      earnedProgressWeight,
      totalProgressWeight,
    ),
    unobtainableProgressSharePercent: boundedTrackPercent(
      unobtainableProgressWeight,
      totalProgressWeight,
    ),
    isMaxAttainable,
  };
}
