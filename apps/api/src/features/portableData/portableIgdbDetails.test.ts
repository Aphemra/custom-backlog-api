import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { openDatabase } from "../../database/database.js";
import { ImageCacheRepository } from "../imageCache/imageCacheRepository.js";
import { ImageCacheService } from "../imageCache/imageCacheService.js";
import { parseIgdbGames } from "../igdb/igdbClient.js";
import { IgdbImageRegistrationService } from "../igdb/igdbImageRegistrationService.js";
import { IgdbMetadataRepository } from "../igdb/igdbMetadataRepository.js";
import { LibraryGameDetailsRepository } from "../library/libraryGameDetailsRepository.js";
import { LibraryGameRepository } from "../library/libraryGameRepository.js";
import {
  createPortableDataExport,
  importPortableData,
} from "./portableDataService.js";
import { parsePortableDataExport } from "./portableDataValidation.js";

test("portable import restores normalized IGDB details and gallery images", async () => {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "portable-igdb-details-"),
  );

  const source = openDatabase(join(temporaryDirectory, "source.sqlite"));

  const target = openDatabase(join(temporaryDirectory, "target.sqlite"));

  try {
    const game = new LibraryGameRepository(source).create({
      title: "Astro Bot",
      platform: "PS5",
    });

    const rawPayload = {
      id: 250766,
      name: "Astro Bot",
      slug: "astro-bot",
      url: "https://www.igdb.com/games/astro-bot",
      summary: "A platforming adventure.",
      game_type: {
        id: 0,
        type: "Main Game",
      },
      platforms: [
        {
          id: 167,
        },
      ],
      release_dates: [
        {
          date: 1_725_580_800,
          platform: {
            id: 167,
          },
        },
      ],
      cover: {
        image_id: "co8abc",
      },
      screenshots: [
        {
          image_id: "sc1",
          width: 1920,
          height: 1080,
        },
      ],
      artworks: [
        {
          image_id: "ar1",
          width: 1920,
          height: 1080,
        },
      ],
    };

    const parsedGame = parseIgdbGames([rawPayload])[0];

    assert.notEqual(parsedGame, undefined);

    if (parsedGame === undefined) {
      throw new Error("The IGDB test fixture did not parse.");
    }

    const timestamp = "2026-08-27T12:00:00.000Z";

    const metadata = new IgdbMetadataRepository(source).upsert(
      {
        ...parsedGame,

        timeToBeat: {
          hastilySeconds: 28_800,
          normallySeconds: 43_200,
          completelySeconds: 64_800,
          submissionCount: 125,
        },
      },
      timestamp,
    );

    source
      .prepare(
        `
          INSERT INTO game_metadata_links (
            game_id,
            metadata_id,
            linked_at
          ) VALUES (?, ?, ?)
        `,
      )
      .run(game.id, metadata.metadataId, timestamp);

    const imageCache = new ImageCacheService(
      new ImageCacheRepository(source),
      join(temporaryDirectory, "images"),
    );

    new IgdbImageRegistrationService(source, imageCache).replaceForGame(
      game.id,
      metadata.metadataId,
      parsedGame,
      timestamp,
    );

    const portableData = parsePortableDataExport(
      createPortableDataExport(source),
    );

    await importPortableData(
      target,
      join(temporaryDirectory, "backups"),
      portableData,
    );

    const restored = new LibraryGameDetailsRepository(target).findById(game.id);

    assert.equal(restored?.igdb?.summary, "A platforming adventure.");

    assert.deepEqual(restored?.igdb?.timeToBeat, {
      hastilySeconds: 28_800,
      normallySeconds: 43_200,
      completelySeconds: 64_800,
      submissionCount: 125,
    });

    assert.equal(restored?.igdb?.images.cover?.width, null);

    assert.deepEqual(restored?.igdb?.images.screenshots, [
      {
        imageId: restored.igdb.images.screenshots[0]?.imageId,
        url: restored.igdb.images.screenshots[0]?.url,
        width: 1920,
        height: 1080,
      },
    ]);

    assert.deepEqual(restored?.igdb?.images.artworks, [
      {
        imageId: restored.igdb.images.artworks[0]?.imageId,
        url: restored.igdb.images.artworks[0]?.url,
        width: 1920,
        height: 1080,
      },
    ]);

    assert.deepEqual(createPortableDataExport(target).data, portableData.data);
  } finally {
    source.close();
    target.close();

    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  }
});
