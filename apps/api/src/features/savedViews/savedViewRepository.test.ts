import assert from "node:assert/strict";
import { test } from "node:test";
import { openDatabase } from "../../database/database.js";
import { CollectionRepository } from "../collections/collectionRepository.js";
import { LibraryGameRepository } from "../library/libraryGameRepository.js";
import { SavedViewRepository } from "./savedViewRepository.js";

test("creates, filters, orders, updates, and deletes saved views", () => {
  const database = openDatabase(":memory:");

  try {
    const games = new LibraryGameRepository(database);

    const collections = new CollectionRepository(database);

    const views = new SavedViewRepository(database);

    const astro = games.create({
      title: "Astro Bot",
      platform: "PS5",
      pursuitStatus: "pursuing_soon",
      notes: "favorite platformer",
    });

    const returnal = games.create({
      title: "Returnal",
      platform: "PS5",
      pursuitStatus: "in_progress",
    });

    const bloodborne = games.create({
      title: "Bloodborne",
      platform: "PS4",
      pursuitStatus: "finished",
    });

    games.archive(bloodborne.id);

    const favorites = collections.create({
      name: "Favorites",
    });

    collections.replaceGames(favorites.id, [
      returnal.id,
      astro.id,
      bloodborne.id,
    ]);

    const builtins = views.list();

    assert.equal(builtins.length, 7);

    assert.equal(builtins.filter((view) => view.isAvailable).length, 3);

    const custom = views.create({
      name: "Active PS5 favorites",
      filters: {
        platforms: ["PS5"],
        collectionIds: [favorites.id],
        archiveMode: "active",
      },
      sort: {
        field: "title",
        direction: "asc",
      },
    });

    assert.equal(custom.isAvailable, true);

    assert.deepEqual(
      views.listUsingCollection(favorites.id).map((view) => view.id),
      [custom.id],
    );

    assert.deepEqual(
      views.listGames(custom).map((game) => game.title),
      ["Astro Bot", "Returnal"],
    );

    assert.deepEqual(
      views.listGames(custom, "favorite").map((game) => game.id),
      [astro.id],
    );

    const updated = views.update(custom.id, {
      name: "Returnal only",
      filters: {
        search: "Returnal",
        archiveMode: "all",
      },
    });

    assert.equal(updated?.name, "Returnal only");

    assert.deepEqual(
      views.listGames(updated!).map((game) => game.id),
      [returnal.id],
    );

    const orderedIds = [custom.id, ...builtins.map((view) => view.id)];

    assert.equal(views.reorder(orderedIds), true);

    assert.equal(views.list()[0]?.id, custom.id);

    assert.equal(views.reorder([custom.id]), false);

    assert.equal(views.delete(custom.id), true);

    assert.equal(views.findById(custom.id), null);
  } finally {
    database.close();
  }
});
