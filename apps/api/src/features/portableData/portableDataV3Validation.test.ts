import assert from "node:assert/strict";
import { test } from "node:test";
import { openDatabase } from "../../database/database.js";
import { CollectionRepository } from "../collections/collectionRepository.js";
import { LibraryGameRepository } from "../library/libraryGameRepository.js";
import { createPortableDataExport } from "./portableDataService.js";
import type { PortableDataExportV3 } from "./portableDataV3Types.js";
import { parsePortableDataV3 } from "./portableDataV3Validation.js";

function createVersionThreeExport(): PortableDataExportV3 {
  const database = openDatabase(":memory:");

  try {
    const games = new LibraryGameRepository(database);
    const collections = new CollectionRepository(database);

    const game = games.create({
      title: "Astro Bot",
      platform: "PS5",
    });

    const collection = collections.create({
      name: "Platformers",
    });

    collections.replaceGames(collection.id, [game.id]);

    const core = createPortableDataExport(database);
    const capturedAt = "2026-08-26T12:00:00.000Z";

    return {
      format: core.format,
      formatVersion: 3,
      exportedAt: core.exportedAt,

      data: {
        libraryGames: core.data.libraryGames,
        collections: core.data.collections,
        savedViews: core.data.savedViews,

        playstationGameLinks: [
          {
            gameId: game.id,
            npCommunicationId: "NPWR00001_00",
            npServiceName: "trophy2",
            psnTitleName: "Astro Bot",
            platforms: ["PS5"],
            iconUrl: "https://example.test/astro-bot.png",
            linkSource: "sync_created",
            payload: {
              npCommunicationId: "NPWR00001_00",
            },
            linkedAt: capturedAt,
            firstSeenAt: capturedAt,
            lastSeenAt: capturedAt,
          },
        ],

        externalGameMetadata: [
          {
            id: "igdb-astro-bot",
            provider: "igdb",
            externalId: "12345",
            title: "Astro Bot",
            coverUrl: "https://images.example.test/astro-bot.jpg",
            releaseDate: "2024-09-06",
            payload: {
              genres: ["Platform"],
            },
            fetchedAt: capturedAt,
          },
        ],

        gameMetadataLinks: [
          {
            gameId: game.id,
            metadataId: "igdb-astro-bot",
            linkedAt: capturedAt,
          },
        ],

        trophySnapshots: [
          {
            id: "snapshot-one",
            gameId: game.id,
            capturedAt,
            bronzeTotal: 10,
            silverTotal: 5,
            goldTotal: 2,
            platinumTotal: 1,
            bronzeEarned: 10,
            silverEarned: 5,
            goldEarned: 2,
            platinumEarned: 1,
            progressPercent: 100,
            is100Percent: true,
            hasPlatinum: true,
            payload: null,
          },
        ],

        trophyAlerts: [
          {
            id: "alert-one",
            gameId: game.id,
            kind: "new_trophies",
            status: "unread",
            previousSnapshotId: null,
            currentSnapshotId: "snapshot-one",
            details: {
              added: 18,
            },
            createdAt: capturedAt,
            resolvedAt: null,
          },
        ],

        cachedImages: [
          {
            id: "astro-cover",
            provider: "igdb",
            sourceKey: "cover:12345",
            sourceUrl: "https://images.example.test/astro-bot.jpg",
            createdAt: capturedAt,
            updatedAt: capturedAt,
          },
        ],

        libraryGameImages: [
          {
            gameId: game.id,
            imageId: "astro-cover",
            role: "cover",
            sortOrder: 0,
            linkedAt: capturedAt,
          },
        ],
      },
    };
  } finally {
    database.close();
  }
}

test("accepts a complete portable version-three contract", () => {
  const portableData = createVersionThreeExport();

  assert.deepEqual(parsePortableDataV3(portableData), portableData);
});

test("rejects broken version-three integration references", () => {
  const portableData = structuredClone(createVersionThreeExport());

  const existingImageLink = portableData.data.libraryGameImages[0]!;

  const brokenExport = {
    ...portableData,

    data: {
      ...portableData.data,

      libraryGameImages: [
        {
          ...existingImageLink,
          imageId: "missing-image",
        },
      ],
    },
  };

  assert.throws(
    () => parsePortableDataV3(brokenExport),
    /library image link contains a broken reference/,
  );
});

test("rejects duplicate PlayStation trophy-stack identities", () => {
  const portableData = structuredClone(createVersionThreeExport());

  const existingLink = portableData.data.playstationGameLinks[0]!;

  const duplicateExport = {
    ...portableData,

    data: {
      ...portableData.data,

      playstationGameLinks: [
        existingLink,
        {
          ...existingLink,
        },
      ],
    },
  };

  assert.throws(
    () => parsePortableDataV3(duplicateExport),
    /cannot contain duplicates/,
  );
});
