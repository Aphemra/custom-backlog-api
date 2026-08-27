import assert from "node:assert/strict";
import { test } from "node:test";
import { openDatabase } from "../../database/database.js";
import { LibraryGameRepository } from "../library/libraryGameRepository.js";
import { PlayStationTitleReconciliationService } from "./playStationTitleReconciliationService.js";
import type {
  PlayStationTitlePreviewResult,
  PlayStationTrophyTitlePreview,
} from "./playStationTypes.js";

function createTitle(
  overrides: Partial<PlayStationTrophyTitlePreview> = {},
): PlayStationTrophyTitlePreview {
  return {
    npServiceName: "trophy2",
    npCommunicationId: "NPWR00001_00",
    trophySetVersion: "01.00",
    name: "Ratchet & Clank",
    detail: null,
    iconUrl: "https://image.api.playstation.com/example.png",
    platforms: ["PS5"],
    hasTrophyGroups: false,
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
    lastUpdatedAt: "2026-08-25T12:00:00Z",
    ...overrides,
  };
}

test("reconciles linked, suggested, ambiguous, and new PSN titles", () => {
  const database = openDatabase(":memory:");
  const library = new LibraryGameRepository(database);

  try {
    const suggestedGame = library.create({
      title: "Ratchet and Clank",
      platform: "PS5",
    });

    const firstAmbiguousGame = library.create({
      title: "Resident Evil 4",
      platform: "PS4",
    });

    library.create({
      title: "Resident Evil 4",
      platform: "PS4",
    });

    const linkedGame = library.create({
      title: "Existing Linked Game",
      platform: "PS5",
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        linkedGame.id,
        "NPWR00002_00",
        "trophy2",
        "Different PSN Name",
        JSON.stringify(["PS5"]),
        null,
        "manual_match",
        JSON.stringify({}),
        "2026-08-25T12:00:00Z",
        "2026-08-25T12:00:00Z",
        "2026-08-25T12:00:00Z",
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
        createTitle(),
        createTitle({
          npCommunicationId: "NPWR00002_00",
          name: "Different PSN Name",
        }),
        createTitle({
          npCommunicationId: "NPWR00003_00",
          npServiceName: "trophy",
          name: "Resident Evil 4",
          platforms: ["PS4"],
        }),
        createTitle({
          npCommunicationId: "NPWR00004_00",
          name: "Entirely New Game",
        }),
      ],
    };

    const result = new PlayStationTitleReconciliationService(
      database,
    ).reconcile(preview);

    assert.deepEqual(result.reconciliationCounts, {
      linked: 1,
      suggestedMatch: 1,
      ambiguous: 1,
      new: 1,
    });

    assert.deepEqual(result.titles[0]?.reconciliation, {
      status: "suggested_match",
      candidates: [
        {
          gameId: suggestedGame.id,
          title: "Ratchet and Clank",
          platform: "PS5",
          archived: false,
          metadataProvider: null,
          playStationLinkSource: null,
        },
      ],
    });

    assert.equal(
      result.titles[1]?.reconciliation.candidates[0]?.gameId,
      linkedGame.id,
    );

    assert.equal(
      result.titles[2]?.reconciliation.candidates[0]?.gameId,
      firstAmbiguousGame.id,
    );

    assert.deepEqual(result.titles[3]?.reconciliation, {
      status: "new",
      candidates: [],
    });
  } finally {
    database.close();
  }
});
