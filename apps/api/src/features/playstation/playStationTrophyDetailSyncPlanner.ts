import type { DatabaseSync } from "node:sqlite";
import type {
  LinkedPlayStationTitlePreviewResult,
  PlayStationTrophyCounts,
  ReconciledPlayStationTitle,
} from "./playStationTypes.js";

export type PlayStationTrophyDetailSyncMode = "none" | "earnings_only" | "full";

export type PlayStationTrophyDetailSyncReason =
  | "up_to_date"
  | "missing_local_details"
  | "provider_identity_changed"
  | "trophy_set_changed"
  | "trophy_totals_changed"
  | "incomplete_local_definitions"
  | "target_account_changed"
  | "missing_local_earnings"
  | "trophy_progress_changed";

export interface PlayStationTrophyDetailSyncPlanItem {
  gameId: string;
  title: ReconciledPlayStationTitle;
  mode: PlayStationTrophyDetailSyncMode;
  reason: PlayStationTrophyDetailSyncReason;
}

export interface PlayStationTrophyDetailSyncPlan {
  items: PlayStationTrophyDetailSyncPlanItem[];
  fullRefreshCount: number;
  earningsOnlyCount: number;
  unchangedCount: number;
}

interface StoredTrophySetRow {
  game_id: string;
  np_communication_id: string;
  np_service_name: "trophy" | "trophy2";
  trophy_set_version: string;
  bronze_total: number;
  silver_total: number;
  gold_total: number;
  platinum_total: number;
  last_observed_title_updated_at: string | null;
  earnings_refreshed_at: string | null;
  earnings_account_id: string | null;
  stored_group_count: number;
  stored_trophy_count: number;
  bronze_earned: number;
  silver_earned: number;
  gold_earned: number;
  platinum_earned: number;
}

function countTrophies(counts: PlayStationTrophyCounts): number {
  return counts.bronze + counts.silver + counts.gold + counts.platinum;
}

function countsEqual(
  first: PlayStationTrophyCounts,
  second: PlayStationTrophyCounts,
): boolean {
  return (
    first.bronze === second.bronze &&
    first.silver === second.silver &&
    first.gold === second.gold &&
    first.platinum === second.platinum
  );
}

function sameInstant(first: string, second: string): boolean {
  return Date.parse(first) === Date.parse(second);
}

function readGameId(title: ReconciledPlayStationTitle): string {
  if (
    title.reconciliation.status !== "linked" ||
    title.reconciliation.candidates.length !== 1
  ) {
    throw new Error(
      "Detailed trophy synchronization requires exactly one linked library game.",
    );
  }

  const candidate = title.reconciliation.candidates[0];

  if (candidate === undefined) {
    throw new Error(
      "Detailed trophy synchronization requires a linked library game.",
    );
  }

  return candidate.gameId;
}

export class PlayStationTrophyDetailSyncPlanner {
  constructor(private readonly database: DatabaseSync) {}

  plan(
    preview: LinkedPlayStationTitlePreviewResult,
  ): PlayStationTrophyDetailSyncPlan {
    const storedRows = this.database
      .prepare(
        `
          SELECT
            trophy_sets.game_id,
            trophy_sets.np_communication_id,
            trophy_sets.np_service_name,
            trophy_sets.trophy_set_version,
            trophy_sets.bronze_total,
            trophy_sets.silver_total,
            trophy_sets.gold_total,
            trophy_sets.platinum_total,
            trophy_sets.last_observed_title_updated_at,
            trophy_sets.earnings_refreshed_at,
            trophy_sets.earnings_account_id,
            (
              SELECT COUNT(*)
              FROM playstation_trophy_groups AS trophy_groups
              WHERE trophy_groups.game_id = trophy_sets.game_id
            ) AS stored_group_count,
            (
              SELECT COUNT(*)
              FROM playstation_trophies AS trophies
              WHERE trophies.game_id = trophy_sets.game_id
            ) AS stored_trophy_count,
            (
              SELECT COUNT(*)
              FROM playstation_trophies AS trophies
              WHERE trophies.game_id = trophy_sets.game_id
                AND trophies.trophy_type = 'bronze'
                AND trophies.is_earned = 1
            ) AS bronze_earned,
            (
              SELECT COUNT(*)
              FROM playstation_trophies AS trophies
              WHERE trophies.game_id = trophy_sets.game_id
                AND trophies.trophy_type = 'silver'
                AND trophies.is_earned = 1
            ) AS silver_earned,
            (
              SELECT COUNT(*)
              FROM playstation_trophies AS trophies
              WHERE trophies.game_id = trophy_sets.game_id
                AND trophies.trophy_type = 'gold'
                AND trophies.is_earned = 1
            ) AS gold_earned,
            (
              SELECT COUNT(*)
              FROM playstation_trophies AS trophies
              WHERE trophies.game_id = trophy_sets.game_id
                AND trophies.trophy_type = 'platinum'
                AND trophies.is_earned = 1
            ) AS platinum_earned
          FROM playstation_trophy_sets AS trophy_sets
        `,
      )
      .all() as unknown as StoredTrophySetRow[];

    const storedByGameId = new Map(storedRows.map((row) => [row.game_id, row]));

    const items = preview.titles.map((title) => {
      const gameId = readGameId(title);
      const stored = storedByGameId.get(gameId);

      return this.planTitle(preview.target.accountId, gameId, title, stored);
    });

    return {
      items,
      fullRefreshCount: items.filter((item) => item.mode === "full").length,
      earningsOnlyCount: items.filter((item) => item.mode === "earnings_only")
        .length,
      unchangedCount: items.filter((item) => item.mode === "none").length,
    };
  }

  private planTitle(
    targetAccountId: string,
    gameId: string,
    title: ReconciledPlayStationTitle,
    stored: StoredTrophySetRow | undefined,
  ): PlayStationTrophyDetailSyncPlanItem {
    if (stored === undefined) {
      return {
        gameId,
        title,
        mode: "full",
        reason: "missing_local_details",
      };
    }

    if (
      stored.np_communication_id !== title.npCommunicationId ||
      stored.np_service_name !== title.npServiceName
    ) {
      return {
        gameId,
        title,
        mode: "full",
        reason: "provider_identity_changed",
      };
    }

    if (stored.trophy_set_version !== title.trophySetVersion) {
      return {
        gameId,
        title,
        mode: "full",
        reason: "trophy_set_changed",
      };
    }

    const storedTotals: PlayStationTrophyCounts = {
      bronze: stored.bronze_total,
      silver: stored.silver_total,
      gold: stored.gold_total,
      platinum: stored.platinum_total,
    };

    if (!countsEqual(storedTotals, title.definedTrophies)) {
      return {
        gameId,
        title,
        mode: "full",
        reason: "trophy_totals_changed",
      };
    }

    if (
      stored.stored_group_count === 0 ||
      stored.stored_trophy_count !== countTrophies(title.definedTrophies)
    ) {
      return {
        gameId,
        title,
        mode: "full",
        reason: "incomplete_local_definitions",
      };
    }

    if (stored.earnings_account_id !== targetAccountId) {
      return {
        gameId,
        title,
        mode: "earnings_only",
        reason: "target_account_changed",
      };
    }

    if (
      stored.earnings_refreshed_at === null ||
      stored.last_observed_title_updated_at === null
    ) {
      return {
        gameId,
        title,
        mode: "earnings_only",
        reason: "missing_local_earnings",
      };
    }

    const storedEarned: PlayStationTrophyCounts = {
      bronze: stored.bronze_earned,
      silver: stored.silver_earned,
      gold: stored.gold_earned,
      platinum: stored.platinum_earned,
    };

    if (
      !countsEqual(storedEarned, title.earnedTrophies) ||
      !sameInstant(stored.last_observed_title_updated_at, title.lastUpdatedAt)
    ) {
      return {
        gameId,
        title,
        mode: "earnings_only",
        reason: "trophy_progress_changed",
      };
    }

    return {
      gameId,
      title,
      mode: "none",
      reason: "up_to_date",
    };
  }
}
