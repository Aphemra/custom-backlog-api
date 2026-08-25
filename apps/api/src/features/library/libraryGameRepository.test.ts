import assert from "node:assert/strict";
import { test } from "node:test";
import { openDatabase } from "../../database/database.js";
import { LibraryGameRepository } from "./libraryGameRepository.js";

test("creates, updates, archives, restores, reorders, and deletes library games", () => {
  const database = openDatabase(":memory:");

  const repository = new LibraryGameRepository(database);

  try {
    const firstGame = repository.create({
      title: "The Last of Us",
      platform: "PS3",
      pursuitStatus: "finished",
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

    assert.deepEqual(
      repository.list().map((game) => game.id),
      [firstGame.id, secondGame.id, thirdGame.id],
    );

    const updatedGame = repository.update(secondGame.id, {
      pursuitStatus: "pursuing_soon",
      notes: null,
    });

    assert.equal(updatedGame?.pursuitStatus, "pursuing_soon");

    assert.equal(updatedGame?.notes, null);

    assert.equal(
      repository.reorder([thirdGame.id, firstGame.id, secondGame.id]),
      true,
    );

    assert.deepEqual(
      repository.list().map((game) => game.id),
      [thirdGame.id, firstGame.id, secondGame.id],
    );

    const archivedGame = repository.archive(firstGame.id);

    assert.notEqual(archivedGame?.archivedAt, null);

    assert.equal(
      repository.list().some((game) => game.id === firstGame.id),
      false,
    );

    assert.equal(
      repository.list(true).some((game) => game.id === firstGame.id),
      true,
    );

    const restoredGame = repository.restore(firstGame.id);

    assert.equal(restoredGame?.archivedAt, null);

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
