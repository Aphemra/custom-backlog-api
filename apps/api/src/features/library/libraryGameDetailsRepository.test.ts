import assert from "node:assert/strict";
import { test } from "node:test";
import { openDatabase } from "../../database/database.js";
import { ImageCacheRepository } from "../imageCache/imageCacheRepository.js";
import { ImageCacheService } from "../imageCache/imageCacheService.js";
import { parseIgdbGames } from "../igdb/igdbClient.js";
import { IgdbImageRegistrationService } from "../igdb/igdbImageRegistrationService.js";
import { IgdbMetadataRepository } from "../igdb/igdbMetadataRepository.js";
import { LibraryGameDetailsRepository } from "./libraryGameDetailsRepository.js";
import { LibraryGameRepository } from "./libraryGameRepository.js";

test("composes local library, IGDB, image, and PlayStation details", () => {
  const database = openDatabase(":memory:");

  try {
    const timestamp = "2026-08-27T12:00:00.000Z";
    const libraryGame = new LibraryGameRepository(database).create({
      title: "Astro Bot",
      platform: "PS5",
      playStatus: "playing",
      notes: null,
    });

    const parsedGame = parseIgdbGames([
      {
        id: 250766,
        name: "Astro Bot",
        slug: "astro-bot",
        url: "https://www.igdb.com/games/astro-bot",
        summary: "A platforming adventure.",
        game_type: { id: 0, type: "Main Game" },
        platforms: [{ id: 167 }],
        release_dates: [{ date: 1_725_580_800, platform: 167 }],
        genres: [{ id: 8, name: "Platform" }],
        involved_companies: [
          {
            company: { id: 123, name: "Team Asobi" },
            developer: true,
            publisher: false,
          },
        ],
        cover: { image_id: "cover-one" },
        screenshots: [{ image_id: "screen-one", width: 1920, height: 1080 }],
        artworks: [{ image_id: "art-one", width: 3840, height: 2160 }],
      },
    ])[0];

    if (parsedGame === undefined) {
      throw new Error("Expected the IGDB fixture to produce one game.");
    }

    const igdbGame = {
      ...parsedGame,
      timeToBeat: {
        hastilySeconds: 28_800,
        normallySeconds: 43_200,
        completelySeconds: 64_800,
        submissionCount: 125,
      },
    };

    const metadata = new IgdbMetadataRepository(database).upsert(
      igdbGame,
      timestamp,
    );

    database
      .prepare(
        `
          INSERT INTO game_metadata_links (
            game_id,
            metadata_id,
            linked_at
          ) VALUES (?, ?, ?)
        `,
      )
      .run(libraryGame.id, metadata.metadataId, timestamp);

    const imageCache = new ImageCacheService(
      new ImageCacheRepository(database),
      "unused-test-cache",
    );

    new IgdbImageRegistrationService(database, imageCache).replaceForGame(
      libraryGame.id,
      metadata.metadataId,
      igdbGame,
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
          ) VALUES (?, ?, 'trophy2', ?, ?, NULL, 'manual_match', '{}', ?, ?, ?)
        `,
      )
      .run(
        libraryGame.id,
        "NPWR00001_00",
        "Astro Bot",
        JSON.stringify(["PS5"]),
        timestamp,
        timestamp,
        timestamp,
      );

    const details = new LibraryGameDetailsRepository(database).findById(
      libraryGame.id,
    );

    assert.notEqual(details, null);
    assert.equal(details?.game.id, libraryGame.id);
    assert.equal(details?.game.trophySummary, null);
    assert.equal(details?.igdb?.externalId, "250766");
    assert.equal(details?.igdb?.summary, "A platforming adventure.");
    assert.deepEqual(details?.igdb?.platforms, ["PS5"]);
    assert.deepEqual(details?.igdb?.genres, [
      { externalId: "8", name: "Platform" },
    ]);
    assert.equal(details?.igdb?.companies[0]?.name, "Team Asobi");
    assert.equal(details?.igdb?.timeToBeat?.normallySeconds, 43_200);
    assert.match(details?.igdb?.images.cover?.url ?? "", /^\/api\/images\//);
    assert.equal(details?.igdb?.images.screenshots.length, 1);
    assert.equal(details?.igdb?.images.artworks.length, 1);
    assert.equal(details?.playStation?.npCommunicationId, "NPWR00001_00");
    assert.equal(details?.playStation?.npServiceName, "trophy2");
  } finally {
    database.close();
  }
});
