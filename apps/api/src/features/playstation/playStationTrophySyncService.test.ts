import assert from "node:assert/strict";
import { test } from "node:test";
import { openDatabase } from "../../database/database.js";
import { LibraryGameRepository } from "../library/libraryGameRepository.js";
import { PlayStationTrophySyncService } from "./playStationTrophySyncService.js";
import type {
  ReconciledPlayStationTitle,
  ReconciledPlayStationTitlePreviewResult,
} from "./playStationTypes.js";

function createTitle(
  gameId: string,
  progress: number,
  bronzeTotal: number,
): ReconciledPlayStationTitle {
  return {
    npServiceName: "trophy2",
    npCommunicationId: "NPWR20000_00",
    trophySetVersion: "01.00",
    name: "Expandable Trophy Game",
    detail: null,
    iconUrl: "https://image.api.playstation.com/example.png",
    cachedIcon: null,
    platforms: ["PS5"],
    hasTrophyGroups: true,
    definedTrophies: {
      bronze: bronzeTotal,
      silver: 10,
      gold: 3,
      platinum: 1,
    },
    progress,
    earnedTrophies: {
      bronze: 40,
      silver: 10,
      gold: 3,
      platinum: 1,
    },
    hidden: false,
    lastUpdatedAt: "2026-08-25T12:00:00Z",
    reconciliation: {
      status: "linked",
      candidates: [
        {
          gameId,
          title: "Expandable Trophy Game",
          platform: "PS5",
          archived: false,
          metadataProvider: null,
          playStationLinkSource: "sync_created",
        },
      ],
    },
  };
}

function createPreview(
  gameId: string,
  progress: number,
  bronzeTotal: number,
  requestsMade: number,
): ReconciledPlayStationTitlePreviewResult {
  return {
    target: {
      accountId: "20002",
      onlineId: "MainAccount",
    },
    providerTitleCount: 1,
    supportedTitleCount: 1,
    excludedTitleCount: 0,
    requestsMade,
    titles: [createTitle(gameId, progress, bronzeTotal)],
    reconciliationCounts: {
      linked: 1,
      suggestedMatch: 0,
      ambiguous: 0,
      new: 0,
    },
  };
}

test("stores snapshots and detects expanded trophy sets and lost completion", () => {
  const database = openDatabase(":memory:");

  const libraryRepository = new LibraryGameRepository(database);

  const game = libraryRepository.create({
    title: "Expandable Trophy Game",
    platform: "PS5",
    playStatus: "not_started",
    notes: null,
  });

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
      ) VALUES (?, ?, 'trophy2', ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      game.id,
      "NPWR20000_00",
      "Expandable Trophy Game",
      JSON.stringify(["PS5"]),
      "https://image.api.playstation.com/example.png",
      "sync_created",
      JSON.stringify({}),
      "2026-08-25T12:00:00Z",
      "2026-08-25T12:00:00Z",
      "2026-08-25T12:00:00Z",
    );

  const timestamps = [
    new Date("2026-08-26T12:00:00Z"),
    new Date("2026-08-26T12:00:01Z"),
    new Date("2026-08-27T12:00:00Z"),
    new Date("2026-08-27T12:00:01Z"),
    new Date("2026-08-28T12:00:00Z"),
    new Date("2026-08-28T12:00:01Z"),
  ];

  const service = new PlayStationTrophySyncService(
    database,
    () => timestamps.shift() ?? new Date(),
  );

  try {
    const first = service.synchronize(createPreview(game.id, 100, 40, 4));

    assert.equal(first.status, "succeeded");
    assert.equal(first.snapshotsCreated, 1);
    assert.equal(first.newTrophyAlertsCreated, 0);
    assert.equal(first.completionLostAlertsCreated, 0);

    assert.equal(libraryRepository.findById(game.id)?.playStatus, "completed");

    const second = service.synchronize(createPreview(game.id, 92, 45, 4));

    assert.equal(second.status, "succeeded");
    assert.equal(second.snapshotsCreated, 1);
    assert.equal(second.newTrophyAlertsCreated, 1);
    assert.equal(second.completionLostAlertsCreated, 1);

    assert.equal(libraryRepository.findById(game.id)?.playStatus, "completed");

    const third = service.synchronize(createPreview(game.id, 100, 45, 4));

    assert.equal(third.status, "succeeded");
    assert.equal(third.snapshotsCreated, 1);
    assert.equal(third.newTrophyAlertsCreated, 0);
    assert.equal(third.completionLostAlertsCreated, 0);

    const snapshotCount = database
      .prepare(
        `
        SELECT COUNT(*) AS count
        FROM trophy_snapshots
      `,
      )
      .get() as unknown as { count: number };

    const alertCounts = database
      .prepare(
        `
        SELECT kind, COUNT(*) AS count
        FROM trophy_alerts
        GROUP BY kind
        ORDER BY kind
      `,
      )
      .all() as unknown as Array<{
      kind: string;
      count: number;
    }>;

    const alertStatuses = database
      .prepare(
        `
        SELECT kind, status, resolved_at
        FROM trophy_alerts
        ORDER BY kind
      `,
      )
      .all() as unknown as Array<{
      kind: string;
      status: string;
      resolved_at: string | null;
    }>;

    assert.equal(snapshotCount.count, 3);

    assert.deepEqual(
      alertCounts.map((row) => ({ ...row })),
      [
        {
          kind: "completion_lost",
          count: 1,
        },
        {
          kind: "new_trophies",
          count: 1,
        },
      ],
    );

    assert.deepEqual(
      alertStatuses.map((row) => ({
        kind: row.kind,
        status: row.status,
        resolved: row.resolved_at !== null,
      })),
      [
        {
          kind: "completion_lost",
          status: "resolved",
          resolved: true,
        },
        {
          kind: "new_trophies",
          status: "unread",
          resolved: false,
        },
      ],
    );
  } finally {
    database.close();
  }
});
