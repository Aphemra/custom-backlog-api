import assert from "node:assert/strict";
import type { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { openDatabase } from "../../database/database.js";
import { HttpError } from "../../errors/httpError.js";
import { LibraryGameRepository } from "../library/libraryGameRepository.js";
import {
  IgdbMetadataRefreshService,
  type IgdbMetadataRefreshProgress,
} from "./igdbMetadataRefreshService.js";

function attachIgdbMetadata(
  database: DatabaseSync,
  gameId: string,
  metadataId: string,
  externalId: string,
  title: string,
): void {
  const timestamp = "2026-08-29T12:00:00.000Z";

  database
    .prepare(
      `
      INSERT INTO external_game_metadata (
        id,
        provider,
        external_id,
        title,
        cover_url,
        release_date,
        payload_json,
        fetched_at
      ) VALUES (?, 'igdb', ?, ?, NULL, NULL, '{}', ?)
    `,
    )
    .run(metadataId, externalId, title, timestamp);

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
    .run(gameId, metadataId, timestamp);
}

test("refreshes recoverable entries and stops safely on a provider failure", async () => {
  const database = openDatabase(":memory:");
  const repository = new LibraryGameRepository(database);

  const games = ["Alpha", "Bravo", "Charlie", "Delta"].map((title, index) => {
    const game = repository.create({
      title,
      platform: "PS5",
      playStatus: "not_started",
      notes: null,
    });

    attachIgdbMetadata(
      database,
      game.id,
      `metadata-${index}`,
      String(1000 + index),
      title,
    );

    return game;
  });

  const attempts: string[] = [];
  const progressUpdates: IgdbMetadataRefreshProgress[] = [];

  const service = new IgdbMetadataRefreshService(database, {
    async refreshExistingGame(gameId: string): Promise<void> {
      attempts.push(gameId);

      if (gameId === games[1]?.id) {
        throw new HttpError(
          404,
          "igdb_game_not_found",
          "This individual IGDB game was not found.",
        );
      }

      if (gameId === games[2]?.id) {
        throw new HttpError(
          503,
          "igdb_rate_limited",
          "IGDB is temporarily rate limiting requests.",
        );
      }
    },
  });

  const result = await service.refreshAll((progress) => {
    progressUpdates.push(progress);
  });

  assert.deepEqual(attempts, [games[0]?.id, games[1]?.id, games[2]?.id]);

  assert.deepEqual(result, {
    expectedGameCount: 4,
    refreshedGameCount: 1,
    failedGameCount: 2,
    skippedGameCount: 1,
    stoppedEarly: true,
    failures: [
      {
        gameId: games[1]?.id,
        title: "Bravo",
        message: "This individual IGDB game was not found.",
      },
      {
        gameId: games[2]?.id,
        title: "Charlie",
        message: "IGDB is temporarily rate limiting requests.",
      },
    ],
  });

  assert.equal(progressUpdates[0]?.completedItems, 0);
  assert.equal(progressUpdates.at(-1)?.completedItems, 3);
  assert.equal(progressUpdates.at(-1)?.totalItems, 4);
  assert.equal(progressUpdates.at(-1)?.currentItem, "Charlie");

  database.close();
});
