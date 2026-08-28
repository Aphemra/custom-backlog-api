import assert from "node:assert/strict";
import { test } from "node:test";
import { openDatabase } from "../../database/database.js";
import { ImageCacheRepository } from "../imageCache/imageCacheRepository.js";
import { ImageCacheService } from "../imageCache/imageCacheService.js";
import { LibraryGameRepository } from "../library/libraryGameRepository.js";
import { parseIgdbGames } from "./igdbClient.js";
import { IgdbImageRegistrationService } from "./igdbImageRegistrationService.js";
import { IgdbMetadataRepository } from "./igdbMetadataRepository.js";

interface ImageLinkRow {
  role: "cover" | "screenshot" | "artwork";
  sort_order: number;
  source_key: string;
  source_url: string;
  width: number | null;
  height: number | null;
}

test("registers and replaces ordered IGDB artwork without downloading it", () => {
  const database = openDatabase(":memory:");

  try {
    const game = parseIgdbGames([
      {
        id: 250766,
        name: "Astro Bot",
        platforms: [{ id: 167 }],
        cover: { image_id: "cover-one" },
        screenshots: [
          { image_id: "screen-one", width: 1920, height: 1080 },
          { image_id: "screen-two", width: 1280, height: 720 },
        ],
        artworks: [{ image_id: "art-one", width: 3840, height: 2160 }],
      },
    ])[0];

    if (game === undefined) {
      throw new Error("Expected the IGDB fixture to produce one game.");
    }

    const libraryGame = new LibraryGameRepository(database).create({
      title: game.title,
      platform: "PS5",
      playStatus: "not_started",
      notes: null,
    });

    const timestamp = "2026-08-27T12:00:00.000Z";
    const metadata = new IgdbMetadataRepository(database).upsert(
      game,
      timestamp,
    );

    const imageCache = new ImageCacheService(
      new ImageCacheRepository(database),
      "unused-test-cache",
    );

    const service = new IgdbImageRegistrationService(database, imageCache);

    const registered = service.replaceForGame(
      libraryGame.id,
      metadata.metadataId,
      game,
      timestamp,
    );

    assert.match(registered.cover?.url ?? "", /^\/api\/images\//);
    assert.equal(registered.screenshots.length, 2);
    assert.equal(registered.artworks.length, 1);

    const initialRows = database
      .prepare(
        `
          SELECT
            igdb_metadata_images.role,
            igdb_metadata_images.sort_order,
            cached_images.source_key,
            cached_images.source_url,
            igdb_metadata_images.width,
            igdb_metadata_images.height
          FROM igdb_metadata_images
          INNER JOIN cached_images
            ON cached_images.id = igdb_metadata_images.image_id
          ORDER BY
            CASE igdb_metadata_images.role
              WHEN 'cover' THEN 0
              WHEN 'screenshot' THEN 1
              ELSE 2
            END,
            igdb_metadata_images.sort_order
        `,
      )
      .all() as unknown as ImageLinkRow[];

    assert.deepEqual(
      initialRows.map((row) => ({
        role: row.role,
        sortOrder: row.sort_order,
        sourceKey: row.source_key,
        width: row.width,
        height: row.height,
      })),
      [
        {
          role: "cover",
          sortOrder: 0,
          sourceKey: "cover:cover-one",
          width: null,
          height: null,
        },
        {
          role: "screenshot",
          sortOrder: 0,
          sourceKey: "screenshot:screen-one",
          width: 1920,
          height: 1080,
        },
        {
          role: "screenshot",
          sortOrder: 1,
          sourceKey: "screenshot:screen-two",
          width: 1280,
          height: 720,
        },
        {
          role: "artwork",
          sortOrder: 0,
          sourceKey: "artwork:art-one",
          width: 3840,
          height: 2160,
        },
      ],
    );

    assert.equal(
      initialRows[1]?.source_url,
      "https://images.igdb.com/igdb/image/upload/" + "t_1080p/screen-one.jpg",
    );

    service.replaceForGame(
      libraryGame.id,
      metadata.metadataId,
      {
        ...game,
        screenshots: [game.screenshots[1]!],
        artworks: [],
      },
      "2026-08-27T13:00:00.000Z",
    );

    const currentSourceKeys = database
      .prepare(
        `
          SELECT cached_images.source_key
          FROM igdb_metadata_images
          INNER JOIN cached_images
            ON cached_images.id = igdb_metadata_images.image_id
          ORDER BY igdb_metadata_images.role, igdb_metadata_images.sort_order
        `,
      )
      .all()
      .map((row) => (row as { source_key: string }).source_key);

    assert.deepEqual(currentSourceKeys, [
      "cover:cover-one",
      "screenshot:screen-two",
    ]);
  } finally {
    database.close();
  }
});
