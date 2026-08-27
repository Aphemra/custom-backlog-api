import type { DatabaseSync } from "node:sqlite";
import { calculatePlayStationTrophyLevel } from "./playStationTrophyPoints.js";
import type { PlayStationTrophyCounts } from "./playStationTypes.js";

interface ProfileSnapshotRow {
  account_id: string;
  captured_at: string;
  trophy_level: number;
  level_progress_percent: number;
  tier: number;
  bronze_earned: number;
  silver_earned: number;
  gold_earned: number;
  platinum_earned: number;
}

export interface PlayStationProfileProgression {
  accountId: string;
  capturedAt: string;
  server: {
    level: number;
    progressPercent: number;
    tier: number;
  };
  earnedTrophies: PlayStationTrophyCounts;
  points: {
    total: number;
    inCurrentLevel: number;
    forCurrentLevel: number;
    toNextLevel: number;
    toLevel999: number;
  };
  calculation: {
    level: number;
    progressPercent: number;
    levelMatchesServer: boolean;
    progressMatchesServer: boolean;
  };
}

export class PlayStationProfileProgressionService {
  constructor(private readonly database: DatabaseSync) {}

  findLatest(): PlayStationProfileProgression | null {
    const row = this.database
      .prepare(
        `
          SELECT
            account_id,
            captured_at,
            trophy_level,
            level_progress_percent,
            tier,
            bronze_earned,
            silver_earned,
            gold_earned,
            platinum_earned
          FROM playstation_profile_snapshots
          ORDER BY captured_at DESC, id DESC
          LIMIT 1
        `,
      )
      .get() as unknown as ProfileSnapshotRow | undefined;

    if (row === undefined) {
      return null;
    }

    const earnedTrophies: PlayStationTrophyCounts = {
      bronze: row.bronze_earned,
      silver: row.silver_earned,
      gold: row.gold_earned,
      platinum: row.platinum_earned,
    };
    const calculated = calculatePlayStationTrophyLevel(earnedTrophies);

    return {
      accountId: row.account_id,
      capturedAt: row.captured_at,
      server: {
        level: row.trophy_level,
        progressPercent: row.level_progress_percent,
        tier: row.tier,
      },
      earnedTrophies,
      points: {
        total: calculated.totalPoints,
        inCurrentLevel: calculated.pointsInLevel,
        forCurrentLevel: calculated.pointsForLevel,
        toNextLevel: calculated.pointsToNextLevel,
        toLevel999: calculated.pointsToLevel999,
      },
      calculation: {
        level: calculated.level,
        progressPercent: calculated.progressPercent,
        levelMatchesServer: calculated.level === row.trophy_level,
        progressMatchesServer:
          calculated.progressPercent === row.level_progress_percent,
      },
    };
  }
}
