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
      playStatus: "not_started",
      notes: "favorite platformer",
    });

    const returnal = games.create({
      title: "Returnal",
      platform: "PS5",
      playStatus: "playing",
    });

    const bloodborne = games.create({
      title: "Bloodborne",
      platform: "PS4",
      playStatus: "completed",
    });

    const ratchet = games.create({
      title: "Ratchet & Clank",
      platform: "PS5",
    });

    games.hide(bloodborne.id);

    const capturedAt = "2026-08-27T12:00:00.000Z";

    const insertSnapshot = database.prepare(`
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
    `);

    insertSnapshot.run(
      "astro-snapshot",
      astro.id,
      capturedAt,
      20,
      10,
      5,
      0,
      20,
      10,
      5,
      0,
      100,
      1,
      0,
    );

    insertSnapshot.run(
      "returnal-snapshot",
      returnal.id,
      capturedAt,
      40,
      10,
      5,
      1,
      35,
      8,
      4,
      1,
      90,
      0,
      1,
    );

    database
      .prepare(
        `
        INSERT INTO trophy_alerts (
          id,
          game_id,
          kind,
          status,
          previous_snapshot_id,
          current_snapshot_id,
          details_json,
          created_at,
          resolved_at
        ) VALUES (
          ?, ?, 'completion_lost', 'unread',
          NULL, ?, '{}', ?, NULL
        )
      `,
      )
      .run(
        "returnal-completion-lost",
        returnal.id,
        "returnal-snapshot",
        capturedAt,
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
        ) VALUES (
          ?, ?, 'trophy2', ?, '["PS5"]',
          NULL, 'manual_match', '{}', ?, ?, ?
        )
      `,
      )
      .run(
        ratchet.id,
        "NPWR_TEST_RATCHET",
        ratchet.title,
        capturedAt,
        capturedAt,
        capturedAt,
      );

    const favorites = collections.create({
      name: "Favorites",
    });

    collections.replaceGames(favorites.id, [
      returnal.id,
      astro.id,
      bloodborne.id,
    ]);

    const builtins = views.list();

    assert.equal(builtins.length, 8);

    assert.equal(builtins.filter((view) => view.isAvailable).length, 8);

    assert.equal(
      builtins.find((view) => view.builtinKey === "not_started")?.name,
      "Not started",
    );

    assert.equal(
      builtins.find((view) => view.builtinKey === "playing")?.name,
      "Playing",
    );

    assert.deepEqual(
      builtins.find((view) => view.builtinKey === "hidden_games")?.filters,
      {
        hiddenMode: "hidden",
      },
    );

    const requireBuiltin = (builtinKey: string) => {
      const view = builtins.find(
        (candidate) => candidate.builtinKey === builtinKey,
      );

      assert.notEqual(view, undefined);

      return view!;
    };

    assert.deepEqual(
      views.listGames(requireBuiltin("hidden_games")).map((game) => game.title),
      ["Bloodborne"],
    );

    assert.deepEqual(
      views
        .listGames(requireBuiltin("one_hundred_percent"))
        .map((game) => game.title),
      ["Astro Bot"],
    );

    assert.deepEqual(
      views
        .listGames(requireBuiltin("completion_lost"))
        .map((game) => game.title),
      ["Returnal"],
    );

    assert.deepEqual(
      views.listGames(requireBuiltin("needs_sync")).map((game) => game.title),
      ["Ratchet & Clank"],
    );

    assert.equal(
      views.listGames(requireBuiltin("platinum_earned"))[0]?.trophySummary
        ?.platinumEarned,
      true,
    );

    const custom = views.create({
      name: "Active PS5 favorites",
      filters: {
        platforms: ["PS5"],
        collectionIds: [favorites.id],
        hiddenMode: "visible",
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
        hiddenMode: "all",
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
