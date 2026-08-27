import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { openDatabase } from "../../database/database.js";
import { ImageCacheRepository } from "../imageCache/imageCacheRepository.js";
import { ImageCacheService } from "../imageCache/imageCacheService.js";
import { PlayStationTrophyArtworkService } from "./playStationTrophyArtworkService.js";
import { PlayStationTrophyDetailRepository } from "./playStationTrophyDetailRepository.js";

const pngBytes = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);

function seedNormalizedTrophies(database: DatabaseSync): void {
  const timestamp = "2026-08-27T12:00:00.000Z";

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
      "artwork-game",
      "Artwork Game",
      "Artwork Game",
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
      "artwork-game",
      "NPWR88888_00",
      "trophy2",
      "Artwork Game",
      JSON.stringify(["PS5"]),
      "https://image.api.playstation.com/title.png",
      "manual_match",
      JSON.stringify({
        npCommunicationId: "NPWR88888_00",
      }),
      timestamp,
      timestamp,
      timestamp,
    );

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
      "artwork-game",
      "NPWR88888_00",
      "trophy2",
      "01.00",
      "Artwork Game",
      JSON.stringify(["PS5"]),
      "https://image.api.playstation.com/title.png",
      0,
      2,
      0,
      0,
      0,
      timestamp,
      timestamp,
      timestamp,
      JSON.stringify({ trophySetVersion: "01.00" }),
      JSON.stringify({ lastUpdatedAt: timestamp }),
      timestamp,
      timestamp,
      "target-account",
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
      "artwork-game",
      "default",
      "Artwork Game",
      "https://image.api.playstation.com/shared.png",
      2,
      0,
      0,
      0,
      JSON.stringify({ trophyGroupId: "default" }),
      timestamp,
      timestamp,
    );

  const insertTrophy = database.prepare(`
    INSERT INTO playstation_trophies (
      game_id,
      trophy_id,
      trophy_group_id,
      trophy_type,
      name,
      icon_url,
      is_secret,
      is_earned,
      definition_payload_json,
      earnings_payload_json,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertTrophy.run(
    "artwork-game",
    0,
    "default",
    "bronze",
    "Shared Artwork Trophy",
    "https://image.api.playstation.com/shared.png",
    0,
    0,
    JSON.stringify({ trophyId: 0 }),
    JSON.stringify({ trophyId: 0, earned: false }),
    timestamp,
    timestamp,
  );

  insertTrophy.run(
    "artwork-game",
    1,
    "default",
    "bronze",
    "Unique Artwork Trophy",
    "https://psnobj.prod.dl.playstation.net/trophy.png",
    0,
    0,
    JSON.stringify({ trophyId: 1 }),
    JSON.stringify({ trophyId: 1, earned: false }),
    timestamp,
    timestamp,
  );
}

test("caches, deduplicates, attaches, and revalidates trophy artwork", async () => {
  const database = openDatabase(":memory:");
  const cacheDirectory = await mkdtemp(join(tmpdir(), "trophy-artwork-"));

  let requestCount = 0;

  const imageCache = new ImageCacheService(
    new ImageCacheRepository(database),
    cacheDirectory,
    async () => {
      requestCount += 1;

      if (requestCount <= 3) {
        return new Response(pngBytes, {
          status: 200,
          headers: {
            "content-type": "image/png",
            etag: '"artwork-v1"',
          },
        });
      }

      return new Response(null, {
        status: 304,
      });
    },
  );

  try {
    seedNormalizedTrophies(database);

    const service = new PlayStationTrophyArtworkService(database, imageCache);

    const first = await service.cacheGame("artwork-game");

    assert.deepEqual(first, {
      referenceCount: 4,
      uniqueImageCount: 3,
      attachedCount: 4,
      failedCount: 0,
      downloadedCount: 3,
      notModifiedCount: 0,
    });

    assert.equal(requestCount, 3);

    const repository = new PlayStationTrophyDetailRepository(database);

    const stored = repository.findByGameId("artwork-game");

    assert.notEqual(stored?.titleIconImageId, null);
    assert.notEqual(stored?.groups[0]?.iconImageId, null);
    assert.notEqual(stored?.groups[0]?.trophies[0]?.iconImageId, null);
    assert.notEqual(stored?.groups[0]?.trophies[1]?.iconImageId, null);

    assert.equal(
      stored?.groups[0]?.iconImageId,
      stored?.groups[0]?.trophies[0]?.iconImageId,
    );

    assert.notEqual(
      stored?.groups[0]?.trophies[0]?.iconImageId,
      stored?.groups[0]?.trophies[1]?.iconImageId,
    );

    const cachedImageCount = database
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM cached_images
          WHERE provider = 'playstation'
            AND file_name IS NOT NULL
        `,
      )
      .get() as unknown as {
      count: number;
    };

    assert.equal(cachedImageCount.count, 3);

    const second = await service.cacheGame("artwork-game");

    assert.deepEqual(second, {
      referenceCount: 4,
      uniqueImageCount: 3,
      attachedCount: 4,
      failedCount: 0,
      downloadedCount: 0,
      notModifiedCount: 3,
    });

    assert.equal(requestCount, 6);
  } finally {
    database.close();
    await rm(cacheDirectory, {
      recursive: true,
      force: true,
    });
  }
});

test("keeps trophy data usable when an artwork URL is rejected", async () => {
  const database = openDatabase(":memory:");
  const cacheDirectory = await mkdtemp(join(tmpdir(), "trophy-artwork-"));

  const imageCache = new ImageCacheService(
    new ImageCacheRepository(database),
    cacheDirectory,
    async () =>
      new Response(pngBytes, {
        status: 200,
        headers: {
          "content-type": "image/png",
        },
      }),
  );

  try {
    seedNormalizedTrophies(database);

    database
      .prepare(
        `
          UPDATE playstation_trophies
          SET
            icon_url = ?,
            icon_image_id = NULL
          WHERE game_id = ?
            AND trophy_id = ?
        `,
      )
      .run("https://example.com/rejected.png", "artwork-game", 1);

    const service = new PlayStationTrophyArtworkService(database, imageCache);

    const result = await service.cacheGame("artwork-game");

    assert.deepEqual(result, {
      referenceCount: 4,
      uniqueImageCount: 3,
      attachedCount: 3,
      failedCount: 1,
      downloadedCount: 2,
      notModifiedCount: 0,
    });

    const stored = new PlayStationTrophyDetailRepository(database).findByGameId(
      "artwork-game",
    );

    assert.equal(stored?.groups[0]?.trophies[1]?.iconImageId, null);

    assert.equal(stored?.groups[0]?.trophies[1]?.name, "Unique Artwork Trophy");
  } finally {
    database.close();
    await rm(cacheDirectory, {
      recursive: true,
      force: true,
    });
  }
});
