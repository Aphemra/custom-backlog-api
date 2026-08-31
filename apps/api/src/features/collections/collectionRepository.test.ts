import assert from "node:assert/strict";
import { test } from "node:test";
import { openDatabase } from "../../database/database.js";
import { LibraryGameRepository } from "../library/libraryGameRepository.js";
import { CollectionRepository } from "./collectionRepository.js";

test("creates, edits, orders, fills, and deletes collections", () => {
  const database = openDatabase(":memory:");
  const games = new LibraryGameRepository(database);
  const collections = new CollectionRepository(database);

  try {
    const firstGame = games.create({
      title: "Astro Bot",
      platform: "PS5",
    });

    const secondGame = games.create({
      title: "Bloodborne",
      platform: "PS4",
    });

    games.hide(secondGame.id);

    const metadataTimestamp = "2026-08-27T12:00:00.000Z";

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
        ) VALUES (?, 'igdb', '250766', 'Astro Bot', NULL, NULL, '{}', ?)
      `,
      )
      .run("astro-igdb", metadataTimestamp);

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
      .run(firstGame.id, "astro-igdb", metadataTimestamp);

    database
      .prepare(
        `
        INSERT INTO igdb_game_details (
          metadata_id,
          platforms_json,
          releases_json,
          screenshots_json,
          artworks_json,
          genres_json,
          game_modes_json,
          companies_json,
          collections_json,
          franchises_json,
          game_type_external_id,
          total_rating_count,
          time_hastily_seconds,
          time_normally_seconds,
          time_completely_seconds,
          time_submission_count,
          is_dlc,
          stored_at
        ) VALUES (
          ?,
          '[]',
          '[]',
          '[]',
          '[]',
          '[]',
          '[]',
          '[]',
          '[]',
          '[]',
          '0',
          0,
          3600,
          7200,
          10800,
          12,
          0,
          ?
        )
      `,
      )
      .run("astro-igdb", metadataTimestamp);

    const insertSnapshot = database.prepare(`
      INSERT INTO trophy_snapshots (
        id,
        game_id,
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
        has_platinum
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertSnapshot.run(
      "astro-snapshot",
      firstGame.id,
      "2026-08-27T12:00:00.000Z",
      1,
      0,
      1,
      1,
      1,
      0,
      1,
      0,
      67,
      0,
      1,
    );

    insertSnapshot.run(
      "bloodborne-snapshot",
      secondGame.id,
      "2026-08-27T12:00:00.000Z",
      2,
      0,
      0,
      0,
      2,
      0,
      0,
      0,
      100,
      1,
      0,
    );

    const firstCollection = collections.create({
      name: "Mascot Platformers",
      description: "Bright and cheerful.",
    });

    const secondCollection = collections.create({
      name: "Souls",
    });

    assert.equal(firstCollection.isPinned, false);
    assert.equal(secondCollection.isPinned, false);

    assert.equal(collections.setPinned(firstCollection.id)?.isPinned, true);
    assert.equal(collections.findById(secondCollection.id)?.isPinned, false);

    assert.equal(collections.setPinned(secondCollection.id)?.isPinned, true);
    assert.equal(collections.findById(firstCollection.id)?.isPinned, false);

    assert.equal(collections.setPinned(null), null);
    assert.equal(collections.findById(secondCollection.id)?.isPinned, false);

    assert.equal(
      collections.replaceGames(firstCollection.id, [
        secondGame.id,
        firstGame.id,
      ]),
      true,
    );

    const populated = collections.findById(firstCollection.id);

    assert.equal(populated?.gameCount, 2);
    assert.equal(populated?.visibleGameCount, 1);
    assert.equal(populated?.hiddenGameCount, 1);
    assert.deepEqual(populated?.trophySummary, {
      gameCountWithTrophies: 2,
      completedGameCount: 1,
      earnedTrophies: {
        bronze: 3,
        silver: 0,
        gold: 1,
        platinum: 0,
      },
      totalTrophies: {
        bronze: 3,
        silver: 0,
        gold: 1,
        platinum: 1,
      },
      points: {
        earned: 135,
        total: 435,
        remaining: 300,
      },
      availability: {
        attainableTrophies: {
          bronze: 3,
          silver: 0,
          gold: 1,
          platinum: 1,
        },
        unobtainableTrophies: {
          bronze: 0,
          silver: 0,
          gold: 0,
          platinum: 0,
        },
        attainablePoints: 435,
        unobtainablePoints: 0,
        attainableProgressPercent: 100,
        earnedProgressSharePercent: 100,
        unobtainableProgressSharePercent: 0,
        isMaxAttainable: false,
      },
    });

    assert.deepEqual(populated?.timeEstimateSummary, {
      gameCountWithEstimates: 1,
      hastily: {
        gameCount: 1,
        totalSeconds: 3_600,
      },
      normally: {
        gameCount: 1,
        totalSeconds: 7_200,
      },
      completely: {
        gameCount: 1,
        totalSeconds: 10_800,
      },
      submissionCount: 12,
    });

    assert.equal(
      collections.findById(secondCollection.id)?.timeEstimateSummary,
      null,
    );

    assert.deepEqual(
      populated?.games.map((game) => game.id),
      [secondGame.id, firstGame.id],
    );

    const updated = collections.update(firstCollection.id, {
      name: "Platformers",
      description: null,
    });

    assert.equal(updated?.name, "Platformers");
    assert.equal(updated?.description, null);

    assert.equal(
      collections.reorder([secondCollection.id, firstCollection.id]),
      true,
    );

    assert.deepEqual(
      collections.list().map((collection) => collection.id),
      [secondCollection.id, firstCollection.id],
    );

    assert.equal(collections.deletePermanently(firstCollection.id), true);

    assert.equal(collections.findById(firstCollection.id), null);
    assert.notEqual(games.findById(firstGame.id), null);
  } finally {
    database.close();
  }
});

test("replaces game memberships while preserving Collection order", () => {
  const database = openDatabase(":memory:");
  const games = new LibraryGameRepository(database);
  const collections = new CollectionRepository(database);

  try {
    const existingGame = games.create({
      title: "Astro Bot",
      platform: "PS5",
    });

    const editedGame = games.create({
      title: "Returnal",
      platform: "PS5",
    });

    const firstCollection = collections.create({
      name: "First",
    });

    const secondCollection = collections.create({
      name: "Second",
    });

    assert.equal(
      collections.replaceGames(firstCollection.id, [existingGame.id]),
      true,
    );

    assert.equal(
      collections.replaceGameMemberships(editedGame.id, [
        firstCollection.id,
        secondCollection.id,
      ]),
      true,
    );

    assert.deepEqual(
      collections.findById(firstCollection.id)?.games.map((game) => game.id),
      [existingGame.id, editedGame.id],
    );

    assert.deepEqual(
      collections.findById(secondCollection.id)?.games.map((game) => game.id),
      [editedGame.id],
    );

    assert.equal(
      collections.replaceGameMemberships(editedGame.id, [secondCollection.id]),
      true,
    );

    assert.deepEqual(
      collections.findById(firstCollection.id)?.games.map((game) => game.id),
      [existingGame.id],
    );

    assert.deepEqual(
      collections.findById(secondCollection.id)?.games.map((game) => game.id),
      [editedGame.id],
    );
  } finally {
    database.close();
  }
});

test("rejects stale collection and membership lists without changing data", () => {
  const database = openDatabase(":memory:");
  const games = new LibraryGameRepository(database);
  const collections = new CollectionRepository(database);

  try {
    const game = games.create({
      title: "Returnal",
      platform: "PS5",
    });

    const firstCollection = collections.create({
      name: "First",
    });

    collections.create({
      name: "Second",
    });

    assert.equal(collections.replaceGames(firstCollection.id, [game.id]), true);

    assert.equal(
      collections.replaceGames(firstCollection.id, ["missing-game"]),
      false,
    );

    assert.deepEqual(
      collections.findById(firstCollection.id)?.games.map((entry) => entry.id),
      [game.id],
    );

    assert.equal(collections.reorder([firstCollection.id]), false);

    assert.deepEqual(
      collections.list().map((collection) => collection.name),
      ["First", "Second"],
    );
  } finally {
    database.close();
  }
});

test("averages trophy progress across every Collection member", () => {
  const database = openDatabase(":memory:");
  const games = new LibraryGameRepository(database);
  const collections = new CollectionRepository(database);

  try {
    const firstGame = games.create({
      title: "Game One",
      platform: "PS5",
    });

    const secondGame = games.create({
      title: "Game Two",
      platform: "PS5",
    });

    const unreleasedGame = games.create({
      title: "Game Three",
      platform: "PS5",
      playStatus: "unreleased",
    });

    const completedGame = games.create({
      title: "Game Four",
      platform: "PS5",
      playStatus: "completed",
    });

    const fifthGame = games.create({
      title: "Game Five",
      platform: "PS5",
    });

    const untrackedGame = games.create({
      title: "Game Six",
      platform: "PS5",
    });

    const insertSnapshot = database.prepare(`
      INSERT INTO trophy_snapshots (
        id,
        game_id,
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
        has_platinum
      ) VALUES (?, ?, ?, 50, 0, 0, 0, ?, 0, 0, 0, ?, ?, 0)
    `);

    insertSnapshot.run(
      "game-one-snapshot",
      firstGame.id,
      "2026-08-30T12:00:00.000Z",
      30,
      60,
      0,
    );

    insertSnapshot.run(
      "game-two-snapshot",
      secondGame.id,
      "2026-08-30T12:00:00.000Z",
      25,
      50,
      0,
    );

    insertSnapshot.run(
      "game-four-snapshot",
      completedGame.id,
      "2026-08-30T12:00:00.000Z",
      50,
      100,
      1,
    );

    insertSnapshot.run(
      "game-five-snapshot",
      fifthGame.id,
      "2026-08-30T12:00:00.000Z",
      10,
      20,
      0,
    );

    const collection = collections.create({
      name: "Average Progress",
    });

    assert.equal(
      collections.replaceGames(collection.id, [
        firstGame.id,
        secondGame.id,
        unreleasedGame.id,
        completedGame.id,
        fifthGame.id,
        untrackedGame.id,
      ]),
      true,
    );

    const populated = collections.findById(collection.id);

    assert.equal(populated?.gameCount, 6);
    assert.equal(populated?.trophySummary?.gameCountWithTrophies, 4);
    assert.equal(populated?.averageTrophyProgressPercent, 38);
  } finally {
    database.close();
  }
});
