import assert from "node:assert/strict";
import type { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { openDatabase } from "../../database/database.js";
import { LibraryGameRepository } from "../library/libraryGameRepository.js";
import { PlayStationLinkedTitleSelector } from "./playStationLinkedTitleSelector.js";
import type {
  PlayStationTitlePreviewResult,
  PlayStationTrophyTitlePreview,
} from "./playStationTypes.js";

function createTitle(
  npCommunicationId: string,
  name: string,
  npServiceName: "trophy" | "trophy2" = "trophy2",
): PlayStationTrophyTitlePreview {
  return {
    npServiceName,
    npCommunicationId,
    trophySetVersion: "01.00",
    name,
    detail: null,
    iconUrl: `https://image.api.playstation.com/${npCommunicationId}.png`,
    platforms: ["PS5"],
    hasTrophyGroups: true,
    definedTrophies: {
      bronze: 40,
      silver: 10,
      gold: 3,
      platinum: 1,
    },
    progress: 50,
    earnedTrophies: {
      bronze: 20,
      silver: 5,
      gold: 1,
      platinum: 0,
    },
    hidden: false,
    lastUpdatedAt: "2026-08-27T12:00:00.000Z",
  };
}

function insertLink(
  database: DatabaseSync,
  gameId: string,
  npCommunicationId: string,
  psnTitleName: string,
): void {
  const timestamp = "2026-08-27T12:00:00.000Z";

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
      gameId,
      npCommunicationId,
      psnTitleName,
      JSON.stringify(["PS5"]),
      `https://image.api.playstation.com/${npCommunicationId}.png`,
      "manual_match",
      JSON.stringify({ npCommunicationId }),
      timestamp,
      timestamp,
      timestamp,
    );
}

test("selects only exact existing PlayStation links for trophy sync", () => {
  const database = openDatabase(":memory:");
  const library = new LibraryGameRepository(database);

  try {
    const visibleLinkedGame = library.create({
      title: "Completely Different Local Name",
      platform: "PS5",
    });

    const hiddenLinkedGame = library.create({
      title: "Hidden Linked Game",
      platform: "PS5",
    });

    const unlinkedNameMatch = library.create({
      title: "Unlinked Matching Name",
      platform: "PS5",
    });

    library.hide(hiddenLinkedGame.id);

    insertLink(
      database,
      visibleLinkedGame.id,
      "NPWR10001_00",
      "Provider Linked Game",
    );

    insertLink(
      database,
      hiddenLinkedGame.id,
      "NPWR10002_00",
      "Hidden Provider Game",
    );

    const preview: PlayStationTitlePreviewResult = {
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
      providerTitleCount: 4,
      supportedTitleCount: 4,
      excludedTitleCount: 0,
      requestsMade: 6,
      titles: [
        createTitle("NPWR10001_00", "Provider Linked Game"),
        createTitle("NPWR10002_00", "Hidden Provider Game"),
        createTitle("NPWR99999_00", unlinkedNameMatch.title),
        createTitle("NPWR10001_00", "Wrong Service Version", "trophy"),
      ],
    };

    const result = new PlayStationLinkedTitleSelector(database).select(preview);

    assert.equal(result.providerTitleCount, 4);
    assert.equal(result.supportedTitleCount, 4);
    assert.equal(result.excludedTitleCount, 0);
    assert.equal(result.linkedTitleCount, 2);
    assert.equal(result.requestsMade, 6);

    assert.deepEqual(result.target, {
      accountId: "20002",
      onlineId: "MainAccount",
    });

    assert.deepEqual(result.targetTrophySummary, {
      trophyLevel: 425,
      progress: 52,
      tier: 5,
      earnedTrophies: {
        bronze: 1_234,
        silver: 456,
        gold: 78,
        platinum: 42,
      },
    });

    assert.deepEqual(
      result.titles.map((title) => ({
        npServiceName: title.npServiceName,
        npCommunicationId: title.npCommunicationId,
        cachedIcon: title.cachedIcon,
        status: title.reconciliation.status,
        gameId: title.reconciliation.candidates[0]?.gameId ?? null,
        archived: title.reconciliation.candidates[0]?.archived ?? null,
      })),
      [
        {
          npServiceName: "trophy2",
          npCommunicationId: "NPWR10001_00",
          cachedIcon: null,
          status: "linked",
          gameId: visibleLinkedGame.id,
          archived: false,
        },
        {
          npServiceName: "trophy2",
          npCommunicationId: "NPWR10002_00",
          cachedIcon: null,
          status: "linked",
          gameId: hiddenLinkedGame.id,
          archived: true,
        },
      ],
    );

    const storedCounts = database
      .prepare(
        `
        SELECT
          (SELECT COUNT(*) FROM library_games) AS game_count,
          (SELECT COUNT(*) FROM playstation_game_links) AS link_count,
          (SELECT COUNT(*) FROM trophy_snapshots) AS snapshot_count
      `,
      )
      .get() as unknown as {
      game_count: number;
      link_count: number;
      snapshot_count: number;
    };

    assert.deepEqual(
      { ...storedCounts },
      {
        game_count: 3,
        link_count: 2,
        snapshot_count: 0,
      },
    );
  } finally {
    database.close();
  }
});
