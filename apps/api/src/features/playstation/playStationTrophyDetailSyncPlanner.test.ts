import assert from "node:assert/strict";
import type { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { openDatabase } from "../../database/database.js";
import {
  PlayStationTrophyDetailSyncPlanner,
  type PlayStationTrophyDetailSyncReason,
} from "./playStationTrophyDetailSyncPlanner.js";
import type {
  LinkedPlayStationTitlePreviewResult,
  ReconciledPlayStationTitle,
} from "./playStationTypes.js";

const STORED_UPDATE = "2026-08-26T12:00:00Z";

interface SeedOptions {
  suffix: string;
  includeDetails?: boolean;
  storedVersion?: string;
  earningsAccountId?: string | null;
  earned?: boolean;
}

function seedLinkedTitle(
  database: DatabaseSync,
  options: SeedOptions,
): ReconciledPlayStationTitle {
  const gameId = `game-${options.suffix}`;
  const npCommunicationId = `NPWR${options.suffix}_00`;
  const timestamp = "2026-08-27T12:00:00.000Z";
  const includeDetails = options.includeDetails ?? true;
  const storedVersion = options.storedVersion ?? "01.00";
  const earningsAccountId =
    options.earningsAccountId === undefined
      ? "target-account"
      : options.earningsAccountId;
  const earned = options.earned ?? false;

  database
    .prepare(
      `
        INSERT INTO library_games (
          id,
          title,
          sort_title,
          platform,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      gameId,
      `Game ${options.suffix}`,
      `Game ${options.suffix}`,
      "PS5",
      timestamp,
      timestamp,
    );

  database
    .prepare(
      `
        INSERT INTO playstation_game_links (
          game_id,
          np_communication_id,
          np_service_name,
          psn_title_name,
          platforms_json,
          icon_url,
          link_source,
          payload_json,
          linked_at,
          first_seen_at,
          last_seen_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      gameId,
      npCommunicationId,
      "trophy2",
      `Game ${options.suffix}`,
      JSON.stringify(["PS5"]),
      "https://example.com/title.png",
      "manual_match",
      JSON.stringify({ npCommunicationId }),
      timestamp,
      timestamp,
      timestamp,
    );

  if (includeDetails) {
    database
      .prepare(
        `
          INSERT INTO playstation_trophy_sets (
            game_id,
            np_communication_id,
            np_service_name,
            trophy_set_version,
            title_name,
            platforms_json,
            icon_url,
            has_trophy_groups,
            bronze_total,
            silver_total,
            gold_total,
            platinum_total,
            last_observed_title_updated_at,
            definitions_refreshed_at,
            earnings_refreshed_at,
            definition_payload_json,
            earnings_payload_json,
            created_at,
            updated_at,
            earnings_account_id
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
          )
        `,
      )
      .run(
        gameId,
        npCommunicationId,
        "trophy2",
        storedVersion,
        `Game ${options.suffix}`,
        JSON.stringify(["PS5"]),
        "https://example.com/title.png",
        0,
        1,
        0,
        0,
        0,
        STORED_UPDATE,
        timestamp,
        timestamp,
        JSON.stringify({ trophySetVersion: storedVersion }),
        JSON.stringify({ lastUpdatedDateTime: STORED_UPDATE }),
        timestamp,
        timestamp,
        earningsAccountId,
      );

    database
      .prepare(
        `
          INSERT INTO playstation_trophy_groups (
            game_id,
            trophy_group_id,
            name,
            icon_url,
            bronze_total,
            silver_total,
            gold_total,
            platinum_total,
            payload_json,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        gameId,
        "default",
        `Game ${options.suffix}`,
        "https://example.com/group.png",
        1,
        0,
        0,
        0,
        JSON.stringify({ trophyGroupId: "default" }),
        timestamp,
        timestamp,
      );

    database
      .prepare(
        `
          INSERT INTO playstation_trophies (
            game_id,
            trophy_id,
            trophy_group_id,
            trophy_type,
            name,
            icon_url,
            is_secret,
            is_earned,
            earned_at,
            rarity,
            earned_rate,
            definition_payload_json,
            earnings_payload_json,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        gameId,
        0,
        "default",
        "bronze",
        "First Trophy",
        "https://example.com/trophy.png",
        0,
        earned ? 1 : 0,
        earned ? STORED_UPDATE : null,
        2,
        25,
        JSON.stringify({ trophyId: 0 }),
        JSON.stringify({
          trophyId: 0,
          earned,
        }),
        timestamp,
        timestamp,
      );
  }

  return {
    npServiceName: "trophy2",
    npCommunicationId,
    trophySetVersion: "01.00",
    name: `Game ${options.suffix}`,
    detail: null,
    iconUrl: "https://example.com/title.png",
    platforms: ["PS5"],
    hasTrophyGroups: false,
    definedTrophies: {
      bronze: 1,
      silver: 0,
      gold: 0,
      platinum: 0,
    },
    progress: earned ? 100 : 0,
    earnedTrophies: {
      bronze: earned ? 1 : 0,
      silver: 0,
      gold: 0,
      platinum: 0,
    },
    hidden: false,
    lastUpdatedAt: STORED_UPDATE,
    cachedIcon: null,
    reconciliation: {
      status: "linked",
      candidates: [
        {
          gameId,
          title: `Game ${options.suffix}`,
          platform: "PS5",
          archived: false,
          metadataProvider: "igdb",
          playStationLinkSource: "manual_match",
        },
      ],
    },
  };
}

test("plans full, earnings-only, and unchanged detail synchronization", () => {
  const database = openDatabase(":memory:");

  try {
    const missing = seedLinkedTitle(database, {
      suffix: "10001",
      includeDetails: false,
    });

    const current = seedLinkedTitle(database, {
      suffix: "10002",
    });

    const progressChanged = seedLinkedTitle(database, {
      suffix: "10003",
    });

    progressChanged.earnedTrophies = {
      bronze: 1,
      silver: 0,
      gold: 0,
      platinum: 0,
    };
    progressChanged.progress = 100;
    progressChanged.lastUpdatedAt = "2026-08-27T12:00:00Z";

    const versionChanged = seedLinkedTitle(database, {
      suffix: "10004",
      storedVersion: "00.90",
    });

    const targetChanged = seedLinkedTitle(database, {
      suffix: "10005",
      earningsAccountId: "different-account",
    });

    const preview: LinkedPlayStationTitlePreviewResult = {
      target: {
        accountId: "target-account",
        onlineId: "TargetAccount",
      },
      targetTrophySummary: {
        trophyLevel: 400,
        progress: 50,
        tier: 4,
        earnedTrophies: {
          bronze: 1_000,
          silver: 200,
          gold: 50,
          platinum: 20,
        },
      },
      providerTitleCount: 5,
      supportedTitleCount: 5,
      excludedTitleCount: 0,
      linkedTitleCount: 5,
      requestsMade: 2,
      titles: [
        missing,
        current,
        progressChanged,
        versionChanged,
        targetChanged,
      ],
    };

    const result = new PlayStationTrophyDetailSyncPlanner(database).plan(
      preview,
    );

    assert.deepEqual(
      result.items.map((item) => ({
        gameId: item.gameId,
        mode: item.mode,
        reason: item.reason,
      })),
      [
        {
          gameId: "game-10001",
          mode: "full",
          reason: "missing_local_details",
        },
        {
          gameId: "game-10002",
          mode: "none",
          reason: "up_to_date",
        },
        {
          gameId: "game-10003",
          mode: "earnings_only",
          reason: "trophy_progress_changed",
        },
        {
          gameId: "game-10004",
          mode: "full",
          reason: "trophy_set_changed",
        },
        {
          gameId: "game-10005",
          mode: "earnings_only",
          reason: "target_account_changed",
        },
      ] satisfies Array<{
        gameId: string;
        mode: "none" | "earnings_only" | "full";
        reason: PlayStationTrophyDetailSyncReason;
      }>,
    );

    assert.equal(result.fullRefreshCount, 2);
    assert.equal(result.earningsOnlyCount, 2);
    assert.equal(result.unchangedCount, 1);
  } finally {
    database.close();
  }
});
