import assert from "node:assert/strict";
import { test } from "node:test";
import { openDatabase } from "../../database/database.js";
import { parseIgdbGames } from "./igdbClient.js";
import { IgdbMetadataRepository } from "./igdbMetadataRepository.js";

interface IgdbDetailsRow {
  metadata_id: string;
  summary: string | null;
  platforms_json: string;
  genres_json: string;
  time_normally_seconds: number | null;
  time_submission_count: number;
}

test("upserts rich IGDB metadata into normalized offline storage", () => {
  const database = openDatabase(":memory:");

  try {
    const parsedGame = parseIgdbGames([
      {
        id: 250766,
        name: "Astro Bot",
        summary: "A platforming adventure.",
        platforms: [{ id: 167 }],
        genres: [{ id: 8, name: "Platform" }],
        cover: { image_id: "co8abc" },
      },
    ])[0];

    if (parsedGame === undefined) {
      throw new Error("Expected the IGDB fixture to produce one game.");
    }

    const repository = new IgdbMetadataRepository(database);
    const storedAt = "2026-08-27T12:00:00.000Z";

    const first = repository.upsert(
      {
        ...parsedGame,
        timeToBeat: {
          hastilySeconds: 28_800,
          normallySeconds: 43_200,
          completelySeconds: 64_800,
          submissionCount: 125,
        },
      },
      storedAt,
    );

    const second = repository.upsert(
      {
        ...parsedGame,
        summary: "An updated platforming adventure.",
        timeToBeat: {
          hastilySeconds: 30_000,
          normallySeconds: 45_000,
          completelySeconds: 68_000,
          submissionCount: 140,
        },
      },
      "2026-08-27T13:00:00.000Z",
    );

    assert.equal(second.metadataId, first.metadataId);
    assert.equal(
      first.coverUrl,
      "https://images.igdb.com/igdb/image/upload/" +
        "t_cover_big_2x/co8abc.jpg",
    );

    const details = database
      .prepare(
        `
          SELECT
            metadata_id,
            summary,
            platforms_json,
            genres_json,
            time_normally_seconds,
            time_submission_count
          FROM igdb_game_details
        `,
      )
      .get() as unknown as IgdbDetailsRow;

    assert.equal(details.metadata_id, first.metadataId);
    assert.equal(details.summary, "An updated platforming adventure.");
    assert.equal(details.platforms_json, JSON.stringify(["PS5"]));
    assert.equal(
      details.genres_json,
      JSON.stringify([{ externalId: "8", name: "Platform" }]),
    );
    assert.equal(details.time_normally_seconds, 45_000);
    assert.equal(details.time_submission_count, 140);
  } finally {
    database.close();
  }
});
