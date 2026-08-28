import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { createApp } from "../app.js";
import { openDatabase } from "../database/database.js";
import type {
  LibraryGameViewData,
  LibraryGameWithArtwork,
} from "../features/library/libraryGameTypes.js";
import type { GameResource } from "../features/resources/gameResourceTypes.js";
import type { SavedView } from "../features/savedViews/savedViewTypes.js";

interface ViewsResponse {
  views: SavedView[];
}

interface ViewResponse {
  view: SavedView;
}

interface SavedViewGame extends LibraryGameWithArtwork {
  readonly resources: readonly GameResource[];
  readonly viewData: LibraryGameViewData;
}

interface ViewGamesResponse extends ViewResponse {
  games: SavedViewGame[];
}

async function closeServer(
  server: ReturnType<ReturnType<typeof createApp>["listen"]>,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) {
        resolve();
        return;
      }

      reject(error);
    });
  });
}

test("exposes saved-view filtering and protects built-in views", async () => {
  const database = openDatabase(":memory:");

  const server = createApp(database).listen(0, "127.0.0.1");

  try {
    await once(server, "listening");

    const address = server.address() as AddressInfo;

    const apiUrl = `http://127.0.0.1:${address.port}/api`;

    for (const game of [
      {
        title: "Astro Bot",
        platform: "PS5",
      },
      {
        title: "Bloodborne",
        platform: "PS4",
      },
    ]) {
      const response = await fetch(`${apiUrl}/library/games`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(game),
      });

      assert.equal(response.status, 201);
    }

    const listResponse = await fetch(`${apiUrl}/saved-views`);

    const listed = (await listResponse.json()) as ViewsResponse;

    assert.equal(listed.views.length, 8);

    assert.equal(listed.views.filter((view) => view.isAvailable).length, 8);

    assert.deepEqual(
      listed.views.find((view) => view.builtinKey === "hidden_games")?.filters,
      {
        hiddenMode: "hidden",
      },
    );

    const createResponse = await fetch(`${apiUrl}/saved-views`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "PS5 games",
        filters: {
          platforms: ["PS5"],
        },
        sort: {
          field: "title",
          direction: "asc",
        },
      }),
    });

    assert.equal(createResponse.status, 201);

    const created = (await createResponse.json()) as ViewResponse;

    const gamesResponse = await fetch(
      `${apiUrl}/saved-views/${created.view.id}/games`,
    );

    const filtered = (await gamesResponse.json()) as ViewGamesResponse;

    assert.deepEqual(
      filtered.games.map((game) => game.title),
      ["Astro Bot"],
    );

    assert.equal(filtered.games[0]?.artwork, null);
    assert.deepEqual(filtered.games[0]?.resources, []);
    assert.deepEqual(filtered.games[0]?.viewData, {
      collectionIds: [],
      hasPlayStationLink: false,
      alerts: [],
    });

    const builtin = listed.views.find(
      (view) => view.builtinKey === "all_games",
    )!;

    const editBuiltinResponse = await fetch(
      `${apiUrl}/saved-views/${builtin.id}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Nope",
        }),
      },
    );

    assert.equal(editBuiltinResponse.status, 409);

    const completionLost = listed.views.find(
      (view) => view.builtinKey === "completion_lost",
    )!;

    const completionLostResponse = await fetch(
      `${apiUrl}/saved-views/${completionLost.id}/games`,
    );

    assert.equal(completionLostResponse.status, 200);

    const completionLostGames =
      (await completionLostResponse.json()) as ViewGamesResponse;

    assert.deepEqual(completionLostGames.games, []);

    const deleteResponse = await fetch(
      `${apiUrl}/saved-views/${created.view.id}`,
      {
        method: "DELETE",
      },
    );

    assert.equal(deleteResponse.status, 204);
  } finally {
    await closeServer(server);
    database.close();
  }
});
