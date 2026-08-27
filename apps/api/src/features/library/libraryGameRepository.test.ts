import assert from "node:assert/strict";
import { test } from "node:test";
import { openDatabase } from "../../database/database.js";
import { ImageCacheRepository } from "../imageCache/imageCacheRepository.js";
import { LibraryGameRepository } from "./libraryGameRepository.js";

test("creates, updates, hides, unhides, reorders, and deletes library games", () => {
  const database = openDatabase(":memory:");

  const repository = new LibraryGameRepository(database);

  try {
    const firstGame = repository.create({
      title: "The Last of Us",
      platform: "PS3",
      playStatus: "completed",
    });

    const secondGame = repository.create({
      title: "Astro Bot",
      platform: "PS5",
      notes: "Play this soon.",
    });

    const thirdGame = repository.create({
      title: "Bloodborne",
      platform: "PS4",
    });

    assert.equal(firstGame.sortTitle, "last of us");

    assert.equal(firstGame.trophySummary, null);
    assert.equal(firstGame.artwork, null);

    const capturedAt = "2026-08-27T12:00:00.000Z";

    const coverImage = new ImageCacheRepository(database).register({
      provider: "igdb",
      sourceKey: "cover:test-astro-bot",
      sourceUrl:
        "https://images.igdb.com/igdb/image/upload/t_cover_big/test.jpg",
    });

    database
      .prepare(
        `
        INSERT INTO library_game_images (
          game_id,
          image_id,
          role,
          sort_order,
          linked_at
        ) VALUES (?, ?, 'cover', 0, ?)
      `,
      )
      .run(secondGame.id, coverImage.id, capturedAt);

    database
      .prepare(
        `
        INSERT INTO trophy_snapshots (
          id,
          game_id,
          sync_run_id,
          captured_at,
          bronze_total,
          silver_total,
          gold_total,
          platinum_total,
          bronze_earned,
          silver_earned,
          gold_earned,
          platinum_earned,
          progress_percent,
          is_100_percent,
          has_platinum,
          payload_json
        ) VALUES (
          ?, ?, NULL, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, NULL
        )
      `,
      )
      .run(
        "astro-bot-snapshot",
        secondGame.id,
        capturedAt,
        20,
        10,
        5,
        1,
        10,
        4,
        1,
        0,
        41,
        0,
        1,
      );

    assert.deepEqual(repository.findById(secondGame.id)?.trophySummary, {
      progressPercent: 41,
      earnedTrophies: {
        bronze: 10,
        silver: 4,
        gold: 1,
        platinum: 0,
      },
      totalTrophies: {
        bronze: 20,
        silver: 10,
        gold: 5,
        platinum: 1,
      },
      points: {
        earned: 360,
        total: 1_350,
        remaining: 990,
      },
      timing: null,
      hasPlatinum: true,
      platinumEarned: false,
      is100Percent: false,
      lastSyncedAt: capturedAt,
    });

    assert.deepEqual(repository.findById(secondGame.id)?.artwork, {
      imageId: coverImage.id,
      url: `/api/images/${coverImage.id}`,
      role: "cover",
    });

    assert.deepEqual(
      repository.list().map((game) => game.id),
      [firstGame.id, secondGame.id, thirdGame.id],
    );

    const updatedGame = repository.update(secondGame.id, {
      playStatus: "waiting",
      isUnobtainable: true,
      notes: null,
    });

    assert.equal(updatedGame?.playStatus, "waiting");
    assert.equal(updatedGame?.isUnobtainable, true);
    assert.equal(updatedGame?.notes, null);

    assert.equal(
      repository.reorder([thirdGame.id, firstGame.id, secondGame.id]),
      true,
    );

    assert.deepEqual(
      repository.list().map((game) => game.id),
      [thirdGame.id, firstGame.id, secondGame.id],
    );

    const hiddenGame = repository.hide(firstGame.id);

    assert.notEqual(hiddenGame?.hiddenAt, null);

    assert.equal(
      repository.list().some((game) => game.id === firstGame.id),
      false,
    );

    assert.equal(
      repository.list(true).some((game) => game.id === firstGame.id),
      true,
    );

    const unhiddenGame = repository.unhide(firstGame.id);

    assert.equal(unhiddenGame?.hiddenAt, null);

    assert.equal(repository.deletePermanently(secondGame.id), true);

    assert.equal(repository.findById(secondGame.id), null);

    assert.equal(repository.deletePermanently(secondGame.id), false);
  } finally {
    database.close();
  }
});

test("rejects incomplete reorder requests without changing the existing order", () => {
  const database = openDatabase(":memory:");

  const repository = new LibraryGameRepository(database);

  try {
    const firstGame = repository.create({
      title: "First",
      platform: "PS4",
    });

    repository.create({
      title: "Second",
      platform: "PS5",
    });

    assert.equal(repository.reorder([firstGame.id]), false);

    assert.deepEqual(
      repository.list().map((game) => game.title),
      ["First", "Second"],
    );
  } finally {
    database.close();
  }
});
