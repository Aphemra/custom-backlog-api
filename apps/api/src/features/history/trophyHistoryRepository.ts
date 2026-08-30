import type { DatabaseSync } from "node:sqlite";
import type {
  PlayStationTrophyCounts,
  PlayStationTrophyType,
} from "../playstation/playStationTypes.js";
import type {
  EarnedTrophyHistoryRecord,
  TrophyHistoryProfileSnapshot,
  TrophyHistoryResult,
} from "./historyTypes.js";
import { buildTrophyProgressionTimeline } from "./trophyProgressionTimeline.js";

interface EarnedTrophyRow {
  game_id: string;
  game_title: string;
  platform: "PS3" | "PS4" | "PS5";
  trophy_id: number;
  trophy_group_id: string;
  trophy_name: string | null;
  trophy_detail: string | null;
  trophy_type: PlayStationTrophyType;
  is_secret: number;
  earned_at: string | null;
  trophy_icon_image_id: string | null;
  game_artwork_image_id: string | null;
}

interface ProfileSnapshotRow {
  account_id: string;
  captured_at: string;
  bronze_earned: number;
  silver_earned: number;
  gold_earned: number;
  platinum_earned: number;
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

function subtractTrophyCounts(
  minuend: PlayStationTrophyCounts,
  subtrahend: PlayStationTrophyCounts,
): PlayStationTrophyCounts {
  return {
    bronze: Math.max(0, minuend.bronze - subtrahend.bronze),
    silver: Math.max(0, minuend.silver - subtrahend.silver),
    gold: Math.max(0, minuend.gold - subtrahend.gold),
    platinum: Math.max(0, minuend.platinum - subtrahend.platinum),
  };
}

function trophyCountsEqual(
  left: PlayStationTrophyCounts,
  right: PlayStationTrophyCounts,
): boolean {
  return (
    left.bronze === right.bronze &&
    left.silver === right.silver &&
    left.gold === right.gold &&
    left.platinum === right.platinum
  );
}

function mapProfileSnapshot(
  row: ProfileSnapshotRow | undefined,
): TrophyHistoryProfileSnapshot | null {
  if (row === undefined) {
    return null;
  }

  return {
    accountId: row.account_id,
    capturedAt: row.captured_at,
    earnedTrophies: {
      bronze: row.bronze_earned,
      silver: row.silver_earned,
      gold: row.gold_earned,
      platinum: row.platinum_earned,
    },
  };
}

export class TrophyHistoryRepository {
  constructor(private readonly database: DatabaseSync) {}

  find(): TrophyHistoryResult {
    const profileSnapshot = this.findLatestProfileSnapshot();
    const rows = this.findEarnedTrophies(profileSnapshot?.accountId ?? null);

    const locallyStoredEarnedTrophies = emptyTrophyCounts();
    const timestampedEarnedTrophies = emptyTrophyCounts();
    const missingEarnedTrophyTimestamps = emptyTrophyCounts();
    const records: EarnedTrophyHistoryRecord[] = [];

    for (const row of rows) {
      locallyStoredEarnedTrophies[row.trophy_type] += 1;

      if (row.earned_at === null) {
        missingEarnedTrophyTimestamps[row.trophy_type] += 1;
        continue;
      }

      timestampedEarnedTrophies[row.trophy_type] += 1;

      records.push({
        gameId: row.game_id,
        gameTitle: row.game_title,
        platform: row.platform,
        trophyId: row.trophy_id,
        trophyGroupId: row.trophy_group_id,
        trophyName: row.trophy_name,
        trophyDetail: row.trophy_detail,
        trophyType: row.trophy_type,
        isSecret: row.is_secret === 1,
        earnedAt: row.earned_at,
        trophyIconImageId: row.trophy_icon_image_id,
        gameArtworkImageId: row.game_artwork_image_id,
      });
    }

    const timeline = buildTrophyProgressionTimeline(records);

    if (profileSnapshot === null) {
      return {
        timeline,
        coverage: {
          latestProfileSnapshot: null,
          locallyStoredEarnedTrophies: copyTrophyCounts(
            locallyStoredEarnedTrophies,
          ),
          timestampedEarnedTrophies: copyTrophyCounts(
            timestampedEarnedTrophies,
          ),
          missingEarnedTrophyTimestamps: copyTrophyCounts(
            missingEarnedTrophyTimestamps,
          ),
          missingFromLocalCache: null,
          missingFromTimeline: null,
          excessInLocalCache: null,
          isComplete: null,
        },
      };
    }

    const missingFromLocalCache = subtractTrophyCounts(
      profileSnapshot.earnedTrophies,
      locallyStoredEarnedTrophies,
    );
    const missingFromTimeline = subtractTrophyCounts(
      profileSnapshot.earnedTrophies,
      timestampedEarnedTrophies,
    );
    const excessInLocalCache = subtractTrophyCounts(
      locallyStoredEarnedTrophies,
      profileSnapshot.earnedTrophies,
    );

    return {
      timeline,
      coverage: {
        latestProfileSnapshot: profileSnapshot,
        locallyStoredEarnedTrophies: copyTrophyCounts(
          locallyStoredEarnedTrophies,
        ),
        timestampedEarnedTrophies: copyTrophyCounts(timestampedEarnedTrophies),
        missingEarnedTrophyTimestamps: copyTrophyCounts(
          missingEarnedTrophyTimestamps,
        ),
        missingFromLocalCache,
        missingFromTimeline,
        excessInLocalCache,
        isComplete:
          trophyCountsEqual(
            timestampedEarnedTrophies,
            profileSnapshot.earnedTrophies,
          ) &&
          trophyCountsEqual(
            locallyStoredEarnedTrophies,
            profileSnapshot.earnedTrophies,
          ),
      },
    };
  }

  private findLatestProfileSnapshot(): TrophyHistoryProfileSnapshot | null {
    const row = this.database
      .prepare(
        `
          SELECT
            account_id,
            captured_at,
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

    return mapProfileSnapshot(row);
  }

  private findEarnedTrophies(
    accountId: string | null,
  ): readonly EarnedTrophyRow[] {
    return this.database
      .prepare(
        `
          SELECT
            trophies.game_id,
            games.title AS game_title,
            games.platform,
            trophies.trophy_id,
            trophies.trophy_group_id,
            trophies.name AS trophy_name,
            trophies.detail AS trophy_detail,
            trophies.trophy_type,
            trophies.is_secret,
            trophies.earned_at,
            trophies.icon_image_id AS trophy_icon_image_id,
            COALESCE(
              (
                SELECT preferred_image.image_id
                FROM library_game_images preferred_image
                WHERE preferred_image.game_id = games.id
                ORDER BY
                  CASE preferred_image.role
                    WHEN 'cover' THEN 0
                    WHEN 'icon' THEN 1
                    ELSE 2
                  END,
                  preferred_image.sort_order ASC,
                  preferred_image.image_id ASC
                LIMIT 1
              ),
              trophy_sets.icon_image_id
            ) AS game_artwork_image_id
          FROM playstation_trophies trophies
          INNER JOIN playstation_trophy_sets trophy_sets
            ON trophy_sets.game_id = trophies.game_id
          INNER JOIN library_games games
            ON games.id = trophies.game_id
          WHERE
            trophies.is_earned = 1
            AND (
              ? IS NULL
              OR trophy_sets.earnings_account_id = ?
            )
          ORDER BY
            trophies.earned_at ASC,
            trophies.game_id ASC,
            trophies.trophy_id ASC
        `,
      )
      .all(accountId, accountId) as unknown as EarnedTrophyRow[];
  }
}
