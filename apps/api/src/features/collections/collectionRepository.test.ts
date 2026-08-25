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

    games.archive(secondGame.id);

    const firstCollection = collections.create({
      name: "Mascot Platformers",
      description: "Bright and cheerful.",
    });

    const secondCollection = collections.create({
      name: "Souls",
    });

    assert.equal(
      collections.replaceGames(firstCollection.id, [
        secondGame.id,
        firstGame.id,
      ]),
      true,
    );

    const populated = collections.findById(firstCollection.id);

    assert.equal(populated?.gameCount, 2);
    assert.equal(populated?.activeGameCount, 1);
    assert.equal(populated?.archivedGameCount, 1);

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
