import assert from "node:assert/strict";
import { test } from "node:test";
import { openDatabase } from "../../database/database.js";
import { LibraryGameRepository } from "../library/libraryGameRepository.js";
import { BacklogHistoryRepository } from "./backlogHistoryRepository.js";

test("appends, filters, and paginates immutable backlog activity", () => {
  const database = openDatabase(":memory:");
  const games = new LibraryGameRepository(database);
  const history = new BacklogHistoryRepository(database);

  try {
    const game = games.create({
      title: "Persona 5",
      platform: "PS4",
      playStatus: "not_started",
      notes: null,
    });

    const added = history.append({
      action: "game_added",
      source: "user",
      occurredAt: "2026-08-29T12:00:00.000Z",
      gameId: game.id,
      gameTitle: game.title,
      summary: "Added Persona 5 to the Library.",
      details: {
        platform: "PS4",
      },
    });

    const statusChanged = history.append({
      action: "play_status_changed",
      source: "user",
      occurredAt: "2026-08-29T13:00:00.000Z",
      gameId: game.id,
      gameTitle: game.title,
      previousPlayStatus: "not_started",
      nextPlayStatus: "playing",
      summary: "Changed Persona 5 from Not started to Playing.",
      details: {},
    });

    assert.equal(added.action, "game_added");
    assert.equal(statusChanged.action, "play_status_changed");

    const allEntries = history.list();

    assert.equal(allEntries.totalItems, 2);
    assert.deepEqual(
      allEntries.entries.map((entry) => entry.id),
      [statusChanged.id, added.id],
    );

    const filtered = history.list({
      gameId: game.id,
      action: "play_status_changed",
      source: "user",
    });

    assert.equal(filtered.totalItems, 1);
    assert.deepEqual(filtered.entries[0], statusChanged);

    const secondPage = history.list({
      direction: "desc",
      limit: 1,
      offset: 1,
    });

    assert.equal(secondPage.totalItems, 2);
    assert.deepEqual(secondPage.entries, [added]);
  } finally {
    database.close();
  }
});

test("preserves historical identity after a game is deleted", () => {
  const database = openDatabase(":memory:");
  const games = new LibraryGameRepository(database);
  const history = new BacklogHistoryRepository(database);

  try {
    const game = games.create({
      title: "Deleted Game",
      platform: "PS5",
      playStatus: "not_started",
      notes: null,
    });

    const entry = history.append({
      action: "game_deleted",
      source: "user",
      gameId: game.id,
      gameTitle: game.title,
      summary: "Deleted Deleted Game from the Library.",
      details: {
        platform: game.platform,
      },
    });

    assert.equal(games.deletePermanently(game.id), true);
    assert.equal(games.findById(game.id), null);

    assert.deepEqual(history.findById(entry.id), entry);
  } finally {
    database.close();
  }
});

test("rejects malformed or context-free backlog activity", () => {
  const database = openDatabase(":memory:");
  const history = new BacklogHistoryRepository(database);

  try {
    assert.throws(
      () =>
        history.append({
          action: "game_hidden",
          source: "user",
          summary: "Missing a game snapshot.",
        }),
      /requires a game snapshot/,
    );

    assert.throws(
      () =>
        history.append({
          action: "play_status_changed",
          source: "user",
          gameId: "game-one",
          gameTitle: "Game One",
          previousPlayStatus: "playing",
          nextPlayStatus: "playing",
          summary: "No actual status change.",
        }),
      /two different Play Status values/,
    );

    assert.throws(
      () =>
        history.append({
          action: "backlog_imported",
          source: "portable_import",
          occurredAt: "not-a-date",
          summary: "Imported a backlog.",
        }),
      /valid timestamp/,
    );
  } finally {
    database.close();
  }
});
