import type { DatabaseSync } from "node:sqlite";
import {
  calculateTrophyPointSummary,
  type PlayStationTrophyPointSummary,
} from "./playStationTrophyPoints.js";
import type {
  PlayStationTrophyCounts,
  PlayStationTrophyType,
} from "./playStationTypes.js";

export type PlayStationTrophyTimingUnavailableReason =
  | "not_earned"
  | "not_applicable"
  | "missing_timestamps"
  | "first_trophy_timestamp_missing";

export interface PlayStationFirstTrophyTiming {
  earnedAt: string | null;
  unavailableReason: "not_earned" | "missing_timestamps" | null;
}

export interface PlayStationCompletionMilestoneTiming {
  earnedAt: string | null;
  elapsedSinceFirstTrophyMilliseconds: number | null;
  unavailableReason: PlayStationTrophyTimingUnavailableReason | null;
}

export interface PlayStationGameTrophyTiming {
  firstTrophy: PlayStationFirstTrophyTiming;
  platinum: PlayStationCompletionMilestoneTiming;
  completion: PlayStationCompletionMilestoneTiming;
}

export interface PlayStationGameTrophyIntelligence {
  counts: {
    earned: PlayStationTrophyCounts;
    total: PlayStationTrophyCounts;
  };
  points: PlayStationTrophyPointSummary;
  timing: PlayStationGameTrophyTiming;
}

export interface TrophyIntelligenceInput {
  trophyType: PlayStationTrophyType;
  earned: boolean;
  earnedAt: string | null;
}

interface TrophyIntelligenceRow {
  game_id: string;
  trophy_type: PlayStationTrophyType;
  is_earned: number;
  earned_at: string | null;
}

interface TimestampedTrophy {
  earnedAt: string;
  timestamp: number;
}

function emptyCounts(): PlayStationTrophyCounts {
  return {
    bronze: 0,
    silver: 0,
    gold: 0,
    platinum: 0,
  };
}

function readTimestamp(earnedAt: string | null): TimestampedTrophy | null {
  if (earnedAt === null) {
    return null;
  }

  const timestamp = Date.parse(earnedAt);

  return Number.isFinite(timestamp) ? { earnedAt, timestamp } : null;
}

function createUnavailableMilestone(
  unavailableReason: PlayStationTrophyTimingUnavailableReason,
): PlayStationCompletionMilestoneTiming {
  return {
    earnedAt: null,
    elapsedSinceFirstTrophyMilliseconds: null,
    unavailableReason,
  };
}

export function calculatePlayStationGameTrophyIntelligence(
  trophies: readonly TrophyIntelligenceInput[],
): PlayStationGameTrophyIntelligence {
  const total = emptyCounts();
  const earned = emptyCounts();
  const earnedTrophies: TrophyIntelligenceInput[] = [];

  for (const trophy of trophies) {
    total[trophy.trophyType] += 1;

    if (trophy.earned) {
      earned[trophy.trophyType] += 1;
      earnedTrophies.push(trophy);
    }
  }

  const timestampedEarned = earnedTrophies
    .map((trophy) => readTimestamp(trophy.earnedAt))
    .filter((trophy): trophy is TimestampedTrophy => trophy !== null);
  const allEarnedTimestampsKnown =
    timestampedEarned.length === earnedTrophies.length;
  const firstTimestampedTrophy =
    timestampedEarned.length === 0
      ? null
      : timestampedEarned.reduce((first, trophy) =>
          trophy.timestamp < first.timestamp ? trophy : first,
        );

  const firstTrophy: PlayStationFirstTrophyTiming =
    earnedTrophies.length === 0
      ? {
          earnedAt: null,
          unavailableReason: "not_earned",
        }
      : !allEarnedTimestampsKnown || firstTimestampedTrophy === null
        ? {
            earnedAt: null,
            unavailableReason: "missing_timestamps",
          }
        : {
            earnedAt: firstTimestampedTrophy.earnedAt,
            unavailableReason: null,
          };

  const platinumTrophies = trophies.filter(
    (trophy) => trophy.trophyType === "platinum",
  );
  const earnedPlatinum = platinumTrophies.find((trophy) => trophy.earned);

  let platinum: PlayStationCompletionMilestoneTiming;

  if (platinumTrophies.length === 0) {
    platinum = createUnavailableMilestone("not_applicable");
  } else if (earnedPlatinum === undefined) {
    platinum = createUnavailableMilestone("not_earned");
  } else {
    const platinumTimestamp = readTimestamp(earnedPlatinum.earnedAt);

    if (platinumTimestamp === null) {
      platinum = createUnavailableMilestone("missing_timestamps");
    } else if (
      firstTimestampedTrophy === null ||
      firstTrophy.earnedAt === null
    ) {
      platinum = {
        earnedAt: platinumTimestamp.earnedAt,
        elapsedSinceFirstTrophyMilliseconds: null,
        unavailableReason: "first_trophy_timestamp_missing",
      };
    } else {
      platinum = {
        earnedAt: platinumTimestamp.earnedAt,
        elapsedSinceFirstTrophyMilliseconds:
          platinumTimestamp.timestamp - firstTimestampedTrophy.timestamp,
        unavailableReason: null,
      };
    }
  }

  const allTrophiesEarned =
    trophies.length > 0 && earnedTrophies.length === trophies.length;

  let completion: PlayStationCompletionMilestoneTiming;

  if (!allTrophiesEarned) {
    completion = createUnavailableMilestone("not_earned");
  } else if (!allEarnedTimestampsKnown || firstTimestampedTrophy === null) {
    completion = createUnavailableMilestone("missing_timestamps");
  } else {
    const finalTrophy = timestampedEarned.reduce((latest, trophy) =>
      trophy.timestamp > latest.timestamp ? trophy : latest,
    );

    completion = {
      earnedAt: finalTrophy.earnedAt,
      elapsedSinceFirstTrophyMilliseconds:
        finalTrophy.timestamp - firstTimestampedTrophy.timestamp,
      unavailableReason: null,
    };
  }

  return {
    counts: {
      earned,
      total,
    },
    points: calculateTrophyPointSummary(earned, total),
    timing: {
      firstTrophy,
      platinum,
      completion,
    },
  };
}

export class PlayStationTrophyIntelligenceService {
  constructor(private readonly database: DatabaseSync) {}

  findByGameId(gameId: string): PlayStationGameTrophyIntelligence | null {
    const rows = this.database
      .prepare(
        `
          SELECT
            game_id,
            trophy_type,
            is_earned,
            earned_at
          FROM playstation_trophies
          WHERE game_id = ?
          ORDER BY trophy_id
        `,
      )
      .all(gameId) as unknown as TrophyIntelligenceRow[];

    return rows.length === 0
      ? null
      : calculatePlayStationGameTrophyIntelligence(
          rows.map((row) => ({
            trophyType: row.trophy_type,
            earned: row.is_earned === 1,
            earnedAt: row.earned_at,
          })),
        );
  }

  findAll(): ReadonlyMap<string, PlayStationGameTrophyIntelligence> {
    const rows = this.database
      .prepare(
        `
          SELECT
            game_id,
            trophy_type,
            is_earned,
            earned_at
          FROM playstation_trophies
          ORDER BY game_id, trophy_id
        `,
      )
      .all() as unknown as TrophyIntelligenceRow[];
    const rowsByGameId = new Map<string, TrophyIntelligenceInput[]>();

    for (const row of rows) {
      const gameTrophies = rowsByGameId.get(row.game_id) ?? [];

      gameTrophies.push({
        trophyType: row.trophy_type,
        earned: row.is_earned === 1,
        earnedAt: row.earned_at,
      });

      rowsByGameId.set(row.game_id, gameTrophies);
    }

    return new Map(
      [...rowsByGameId].map(([gameId, trophies]) => [
        gameId,
        calculatePlayStationGameTrophyIntelligence(trophies),
      ]),
    );
  }
}
