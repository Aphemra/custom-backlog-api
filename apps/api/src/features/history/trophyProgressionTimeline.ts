import {
  calculatePlayStationTrophyLevel,
  playStationTrophyPointValues,
} from "../playstation/playStationTrophyPoints.js";
import type {
  PlayStationTrophyCounts,
  PlayStationTrophyType,
} from "../playstation/playStationTypes.js";
import type {
  EarnedTrophyHistoryRecord,
  TrophyHistoryMilestone,
  TrophyHistoryMilestoneKind,
  TrophyHistoryTimeline,
  TrophyProgressionEntry,
} from "./historyTypes.js";

const TROPHY_TOTAL_MILESTONE_INTERVAL = 100;
const PLATINUM_TOTAL_MILESTONE_INTERVAL = 5;
const TROPHY_LEVEL_MILESTONE_INTERVAL = 10;

interface PreparedTrophyRecord {
  readonly record: EarnedTrophyHistoryRecord;
  readonly earnedAtMilliseconds: number;
}

function emptyTrophyCounts(): PlayStationTrophyCounts {
  return {
    bronze: 0,
    silver: 0,
    gold: 0,
    platinum: 0,
  };
}

function copyTrophyCounts(
  counts: PlayStationTrophyCounts,
): PlayStationTrophyCounts {
  return {
    bronze: counts.bronze,
    silver: counts.silver,
    gold: counts.gold,
    platinum: counts.platinum,
  };
}

function totalTrophies(counts: PlayStationTrophyCounts): number {
  return counts.bronze + counts.silver + counts.gold + counts.platinum;
}

function prepareRecord(
  record: EarnedTrophyHistoryRecord,
): PreparedTrophyRecord {
  const earnedAtMilliseconds = Date.parse(record.earnedAt);

  if (!Number.isFinite(earnedAtMilliseconds)) {
    throw new RangeError(
      `Trophy ${record.gameId}:${record.trophyId} has an invalid earnedAt timestamp.`,
    );
  }

  if (!Number.isSafeInteger(record.trophyId) || record.trophyId < 0) {
    throw new RangeError(
      `Trophy ${record.gameId}:${record.trophyId} has an invalid trophy ID.`,
    );
  }

  return {
    record,
    earnedAtMilliseconds,
  };
}

function comparePreparedRecords(
  left: PreparedTrophyRecord,
  right: PreparedTrophyRecord,
): number {
  if (left.earnedAtMilliseconds !== right.earnedAtMilliseconds) {
    return left.earnedAtMilliseconds - right.earnedAtMilliseconds;
  }

  const gameComparison = left.record.gameId.localeCompare(
    right.record.gameId,
    "en-US",
  );

  if (gameComparison !== 0) {
    return gameComparison;
  }

  return left.record.trophyId - right.record.trophyId;
}

function milestoneValuesCrossed(
  previousValue: number,
  nextValue: number,
  interval: number,
  includeFirst: boolean,
): readonly number[] {
  const values: number[] = [];

  if (includeFirst && previousValue === 0 && nextValue > 0) {
    values.push(1);
  }

  let candidate = Math.floor(previousValue / interval) * interval + interval;

  while (candidate <= nextValue) {
    values.push(candidate);
    candidate += interval;
  }

  return values;
}

function createMilestone(
  kind: TrophyHistoryMilestoneKind,
  value: number,
  entry: TrophyProgressionEntry,
): TrophyHistoryMilestone {
  return {
    id: `${kind}:${value}`,
    kind,
    value,
    achievedAt: entry.earnedAt,
    triggeringGameId: entry.gameId,
    triggeringGameTitle: entry.gameTitle,
    triggeringTrophyId: entry.trophyId,
    triggeringTrophyName: entry.trophyName,
    triggeringTrophyType: entry.trophyType,
    cumulativeTrophies: copyTrophyCounts(entry.cumulativeTrophies),
    cumulativeTrophyCount: entry.cumulativeTrophyCount,
    cumulativePoints: entry.cumulativePoints,
    calculatedLevel: entry.calculatedLevel,
    calculatedLevelProgressPercent: entry.calculatedLevelProgressPercent,
  };
}

function appendMilestones(
  milestones: TrophyHistoryMilestone[],
  previousTrophyCount: number,
  previousPlatinumCount: number,
  previousLevel: number,
  entry: TrophyProgressionEntry,
): void {
  const trophyTotalMilestones = milestoneValuesCrossed(
    previousTrophyCount,
    entry.cumulativeTrophyCount,
    TROPHY_TOTAL_MILESTONE_INTERVAL,
    true,
  );

  for (const value of trophyTotalMilestones) {
    milestones.push(createMilestone("trophy_total", value, entry));
  }

  const platinumTotalMilestones = milestoneValuesCrossed(
    previousPlatinumCount,
    entry.cumulativeTrophies.platinum,
    PLATINUM_TOTAL_MILESTONE_INTERVAL,
    true,
  );

  for (const value of platinumTotalMilestones) {
    milestones.push(createMilestone("platinum_total", value, entry));
  }

  const levelMilestones = milestoneValuesCrossed(
    previousLevel,
    entry.calculatedLevel,
    TROPHY_LEVEL_MILESTONE_INTERVAL,
    false,
  );

  for (const value of levelMilestones) {
    milestones.push(createMilestone("trophy_level", value, entry));
  }
}

export function buildTrophyProgressionTimeline(
  records: readonly EarnedTrophyHistoryRecord[],
): TrophyHistoryTimeline {
  const preparedRecords = records
    .map(prepareRecord)
    .sort(comparePreparedRecords);

  const trophyIdentities = new Set<string>();
  const earnedTrophies = emptyTrophyCounts();
  const entries: TrophyProgressionEntry[] = [];
  const milestones: TrophyHistoryMilestone[] = [];

  let cumulativePoints = 0;
  let previousLevel = calculatePlayStationTrophyLevel(earnedTrophies).level;

  for (const prepared of preparedRecords) {
    const record = prepared.record;
    const identity = `${record.gameId}:${record.trophyId}`;

    if (trophyIdentities.has(identity)) {
      throw new RangeError(
        `Trophy history contains duplicate trophy ${identity}.`,
      );
    }

    trophyIdentities.add(identity);

    const previousTrophyCount = totalTrophies(earnedTrophies);
    const previousPlatinumCount = earnedTrophies.platinum;

    earnedTrophies[record.trophyType] += 1;

    const pointsAwarded = playStationTrophyPointValues[record.trophyType];

    cumulativePoints += pointsAwarded;

    const calculatedLevel = calculatePlayStationTrophyLevel(earnedTrophies);

    const entry: TrophyProgressionEntry = {
      ...record,
      sequenceNumber: entries.length + 1,
      pointsAwarded,
      cumulativeTrophies: copyTrophyCounts(earnedTrophies),
      cumulativeTrophyCount: totalTrophies(earnedTrophies),
      cumulativePoints,
      calculatedLevel: calculatedLevel.level,
      calculatedLevelProgressPercent: calculatedLevel.progressPercent,
    };

    entries.push(entry);

    appendMilestones(
      milestones,
      previousTrophyCount,
      previousPlatinumCount,
      previousLevel,
      entry,
    );

    previousLevel = calculatedLevel.level;
  }

  const finalLevel = calculatePlayStationTrophyLevel(earnedTrophies);

  return {
    entries,
    milestones,
    summary: {
      oldestEarnedAt: entries[0]?.earnedAt ?? null,
      newestEarnedAt: entries.at(-1)?.earnedAt ?? null,
      earnedTrophies: copyTrophyCounts(earnedTrophies),
      earnedTrophyCount: totalTrophies(earnedTrophies),
      totalPoints: cumulativePoints,
      calculatedLevel: finalLevel.level,
      calculatedLevelProgressPercent: finalLevel.progressPercent,
    },
  };
}

export function trophyPointValue(trophyType: PlayStationTrophyType): number {
  return playStationTrophyPointValues[trophyType];
}
