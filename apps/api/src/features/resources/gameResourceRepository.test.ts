import assert from "node:assert/strict";
import { test } from "node:test";
import { openDatabase } from "../../database/database.js";
import { HttpError } from "../../errors/httpError.js";
import { LibraryGameRepository } from "../library/libraryGameRepository.js";
import { GameResourceRepository } from "./gameResourceRepository.js";

test("creates, updates, orders, and deletes game resources", () => {
  const database = openDatabase(":memory:");

  try {
    const game = new LibraryGameRepository(database).create({
      title: "Astro Bot",
      platform: "PS5",
    });

    const resources = new GameResourceRepository(database);

    const trophyPage = resources.create(game.id, {
      resourceType: "trophy_page",
      url: "https://psnprofiles.com/trophies/12345-astro-bot",
    });

    const guide = resources.create(game.id, {
      resourceType: "guide",
      url: "https://www.powerpyx.com/astro-bot-trophy-guide-roadmap/",
      label: "PowerPyx guide",
    });

    const map = resources.create(game.id, {
      resourceType: "interactive_map",
      url: "https://mapgenie.io/astro-bot/maps/example",
      label: "Collectible map",
    });

    assert.notEqual(trophyPage, null);
    assert.notEqual(guide, null);
    assert.notEqual(map, null);

    if (trophyPage === null || guide === null || map === null) {
      throw new Error("Expected all test resources to be created.");
    }

    assert.deepEqual(
      resources.listByGame(game.id).map((resource) => ({
        id: resource.id,
        resourceType: resource.resourceType,
        provider: resource.provider,
        label: resource.label,
        sortOrder: resource.sortOrder,
      })),
      [
        {
          id: trophyPage.id,
          resourceType: "trophy_page",
          provider: "psnprofiles",
          label: null,
          sortOrder: 1_000,
        },
        {
          id: guide.id,
          resourceType: "guide",
          provider: "powerpyx",
          label: "PowerPyx guide",
          sortOrder: 2_000,
        },
        {
          id: map.id,
          resourceType: "interactive_map",
          provider: "mapgenie",
          label: "Collectible map",
          sortOrder: 3_000,
        },
      ],
    );

    const updatedGuide = resources.update(game.id, guide.id, {
      url: "https://psnprofiles.com/guide/12345-astro-bot-trophy-guide",
    });

    assert.notEqual(updatedGuide, null);
    assert.equal(updatedGuide?.resourceType, "guide");
    assert.equal(updatedGuide?.provider, "psnprofiles");
    assert.equal(updatedGuide?.label, "PowerPyx guide");

    assert.equal(
      resources.reorder(game.id, [map.id, trophyPage.id, guide.id]),
      true,
    );

    assert.deepEqual(
      resources.listByGame(game.id).map((resource) => ({
        id: resource.id,
        sortOrder: resource.sortOrder,
      })),
      [
        {
          id: map.id,
          sortOrder: 1_000,
        },
        {
          id: trophyPage.id,
          sortOrder: 2_000,
        },
        {
          id: guide.id,
          sortOrder: 3_000,
        },
      ],
    );

    assert.equal(resources.deletePermanently(game.id, guide.id), true);

    assert.equal(resources.deletePermanently(game.id, guide.id), false);

    assert.deepEqual(
      resources.listByGame(game.id).map((resource) => resource.id),
      [map.id, trophyPage.id],
    );

    database.prepare("DELETE FROM library_games WHERE id = ?").run(game.id);

    assert.deepEqual(resources.listByGame(game.id), []);
  } finally {
    database.close();
  }
});

test("rejects conflicts, invalid partial edits, and incomplete ordering", () => {
  const database = openDatabase(":memory:");

  try {
    const games = new LibraryGameRepository(database);

    const firstGame = games.create({
      title: "Returnal",
      platform: "PS5",
    });

    const secondGame = games.create({
      title: "Demon's Souls",
      platform: "PS5",
    });

    const resources = new GameResourceRepository(database);

    const trophyPage = resources.create(firstGame.id, {
      resourceType: "trophy_page",
      url: "https://psnprofiles.com/trophies/10000-returnal",
    });

    const guide = resources.create(firstGame.id, {
      resourceType: "guide",
      url: "https://www.powerpyx.com/returnal-trophy-guide-roadmap/",
    });

    const secondGameGuide = resources.create(secondGame.id, {
      resourceType: "guide",
      url: "https://example.com/demons-souls-guide",
    });

    assert.notEqual(trophyPage, null);
    assert.notEqual(guide, null);
    assert.notEqual(secondGameGuide, null);

    if (trophyPage === null || guide === null || secondGameGuide === null) {
      throw new Error("Expected test resources to be created.");
    }

    assert.throws(
      () =>
        resources.create(firstGame.id, {
          resourceType: "trophy_page",
          url: "https://psnprofiles.com/trophies/10001-returnal",
        }),
      (error: unknown) =>
        error instanceof HttpError &&
        error.code === "trophy_page_already_exists",
    );

    assert.throws(
      () =>
        resources.create(firstGame.id, {
          resourceType: "guide",
          url: guide.url,
        }),
      (error: unknown) =>
        error instanceof HttpError &&
        error.code === "resource_url_already_exists",
    );

    assert.throws(
      () =>
        resources.update(firstGame.id, guide.id, {
          resourceType: "interactive_map",
        }),
      (error: unknown) =>
        error instanceof HttpError &&
        error.code === "resource_provider_mismatch",
    );

    assert.equal(resources.reorder(firstGame.id, [trophyPage.id]), false);

    assert.equal(
      resources.reorder(firstGame.id, [
        trophyPage.id,
        guide.id,
        secondGameGuide.id,
      ]),
      false,
    );

    assert.equal(
      resources.create("missing-game", {
        resourceType: "guide",
        url: "https://example.com/missing-game-guide",
      }),
      null,
    );

    assert.equal(
      resources.update(firstGame.id, "missing-resource", {
        label: "Missing",
      }),
      null,
    );

    assert.equal(
      resources.deletePermanently(firstGame.id, "missing-resource"),
      false,
    );
  } finally {
    database.close();
  }
});
