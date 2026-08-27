import assert from "node:assert/strict";
import { test } from "node:test";
import { openDatabase } from "../../database/database.js";
import { HttpError } from "../../errors/httpError.js";
import { PlayStationTitleLinkService } from "./playStationTitleLinkService.js";
import type {
  ReconciledPlayStationTitle,
  ReconciledPlayStationTitlePreviewResult,
} from "./playStationTypes.js";

function createPreviewTitle(): ReconciledPlayStationTitle {
  return {
    npServiceName: "trophy2",
    npCommunicationId: "NPWR10000_00",
    trophySetVersion: "01.00",
    name: "Example PSN Game",
    detail: null,
    iconUrl: "https://image.api.playstation.com/example.png",
    cachedIcon: null,
    platforms: ["PS4", "PS5"],
    hasTrophyGroups: true,
    definedTrophies: {
      bronze: 40,
      silver: 10,
      gold: 3,
      platinum: 1,
    },
    progress: 100,
    earnedTrophies: {
      bronze: 10,
      silver: 2,
      gold: 0,
      platinum: 0,
    },
    hidden: false,
    lastUpdatedAt: "2026-08-25T12:00:00Z",
    reconciliation: {
      status: "new",
      candidates: [],
    },
  };
}

function createPreview(): ReconciledPlayStationTitlePreviewResult {
  return {
    target: {
      accountId: "20002",
      onlineId: "MainAccount",
    },
    targetTrophySummary: {
      trophyLevel: 425,
      progress: 52,
      tier: 5,
      earnedTrophies: {
        bronze: 1_234,
        silver: 456,
        gold: 78,
        platinum: 42,
      },
    },
    providerTitleCount: 1,
    supportedTitleCount: 1,
    excludedTitleCount: 0,
    requestsMade: 6,
    titles: [createPreviewTitle()],
    reconciliationCounts: {
      linked: 0,
      suggestedMatch: 0,
      ambiguous: 0,
      new: 1,
    },
  };
}

test("atomically creates and links a library game from a PSN preview", () => {
  const database = openDatabase(":memory:");
  const service = new PlayStationTitleLinkService(database);

  try {
    service.rememberPreview(createPreview());

    const result = service.createAndLinkTitle({
      npServiceName: "trophy2",
      npCommunicationId: "NPWR10000_00",
      platform: "PS5",
      playStatus: "waiting",
    });

    assert.equal(result.game.title, "Example PSN Game");
    assert.equal(result.game.platform, "PS5");
    assert.equal(result.game.playStatus, "completed");

    assert.equal(result.link.gameId, result.game.id);
    assert.equal(result.link.npCommunicationId, "NPWR10000_00");
    assert.equal(result.link.linkSource, "sync_created");

    const storedGame = database
      .prepare(
        `
        SELECT title, platform, play_status
        FROM library_games
        WHERE id = ?
      `,
      )
      .get(result.game.id) as
      | {
          title: string;
          platform: string;
          play_status: string;
        }
      | undefined;

    assert.notEqual(storedGame, undefined);
    assert.equal(storedGame?.title, "Example PSN Game");
    assert.equal(storedGame?.platform, "PS5");
    assert.equal(storedGame?.play_status, "completed");
  } finally {
    database.close();
  }
});

test("rolls back creation when the selected platform is incompatible", () => {
  const database = openDatabase(":memory:");
  const service = new PlayStationTitleLinkService(database);

  try {
    service.rememberPreview(createPreview());

    assert.throws(
      () =>
        service.createAndLinkTitle({
          npServiceName: "trophy2",
          npCommunicationId: "NPWR10000_00",
          platform: "PS3",
          playStatus: "not_started",
        }),
      (error: unknown) =>
        error instanceof HttpError &&
        error.code === "playstation_platform_mismatch",
    );

    const count = database
      .prepare(
        `
        SELECT COUNT(*) AS count
        FROM library_games
      `,
      )
      .get() as unknown as { count: number };

    assert.equal(count.count, 0);
  } finally {
    database.close();
  }
});
