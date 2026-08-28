import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { createApp } from "../app.js";
import { openDatabase } from "../database/database.js";
import { LibraryGameRepository } from "../features/library/libraryGameRepository.js";
import type {
  LibraryGame,
  LibraryGameViewData,
} from "../features/library/libraryGameTypes.js";
import type { GameResource } from "../features/resources/gameResourceTypes.js";

interface GameResponse {
  game: LibraryGame;
}

interface LibraryGameWithResources extends LibraryGame {
  resources: GameResource[];
  viewData: LibraryGameViewData;
}

interface GamesResponse {
  games: LibraryGameWithResources[];
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

test("exposes library management through the local API", async () => {
  const database = openDatabase(":memory:");

  const createdGame = new LibraryGameRepository(database).create({
    title: "Astro Bot",
    platform: "PS5",
  });

  const server = createApp(database).listen(0, "127.0.0.1");

  try {
    await once(server, "listening");

    const address = server.address() as AddressInfo;

    const baseUrl = `http://127.0.0.1:${address.port}/api/library`;

    const detailsResponse = await fetch(
      `${baseUrl}/games/${createdGame.id}/details`,
    );

    assert.equal(detailsResponse.status, 200);

    const detailsPayload = (await detailsResponse.json()) as {
      details: {
        game: LibraryGame;
        igdb: unknown;
        playStation: unknown;
      };
    };

    assert.equal(detailsPayload.details.game.id, createdGame.id);
    assert.equal(detailsPayload.details.igdb, null);
    assert.equal(detailsPayload.details.playStation, null);

    const createResourceResponse = await fetch(
      `${baseUrl}/games/${createdGame.id}/resources`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          resourceType: "guide",
          url: "https://www.powerpyx.com/astro-bot-trophy-guide-roadmap/",
          label: "Trophy guide",
        }),
      },
    );

    assert.equal(createResourceResponse.status, 201);

    const updateResponse = await fetch(`${baseUrl}/games/${createdGame.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        playStatus: "playing",
        isUnobtainable: true,
      }),
    });

    assert.equal(updateResponse.status, 200);

    const updated = (await updateResponse.json()) as GameResponse;

    assert.equal(updated.game.playStatus, "playing");
    assert.equal(updated.game.isUnobtainable, true);

    const hideResponse = await fetch(
      `${baseUrl}/games/${createdGame.id}/hide`,
      {
        method: "POST",
      },
    );

    assert.equal(hideResponse.status, 200);

    const hidden = (await hideResponse.json()) as GameResponse;

    assert.notEqual(hidden.game.hiddenAt, null);

    const hiddenListResponse = await fetch(
      `${baseUrl}/games?includeHidden=true`,
    );

    const hiddenList = (await hiddenListResponse.json()) as GamesResponse;

    assert.equal(hiddenList.games.length, 1);

    const unhideResponse = await fetch(
      `${baseUrl}/games/${createdGame.id}/unhide`,
      {
        method: "POST",
      },
    );

    assert.equal(unhideResponse.status, 200);

    const unhidden = (await unhideResponse.json()) as GameResponse;

    assert.equal(unhidden.game.hiddenAt, null);

    const listResponse = await fetch(`${baseUrl}/games`);

    const listed = (await listResponse.json()) as GamesResponse;

    assert.equal(listed.games.length, 1);

    assert.equal(listed.games[0]?.id, createdGame.id);
    assert.equal(listed.games[0]?.resources.length, 1);
    assert.equal(listed.games[0]?.resources[0]?.resourceType, "guide");
    assert.equal(listed.games[0]?.resources[0]?.provider, "powerpyx");
    assert.equal(listed.games[0]?.resources[0]?.label, "Trophy guide");
    assert.deepEqual(listed.games[0]?.viewData, {
      collectionIds: [],
      hasPlayStationLink: false,
      alerts: [],
    });

    const manualCreateResponse = await fetch(`${baseUrl}/games`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Unsupported manual entry",
        platform: "PS5",
      }),
    });

    assert.equal(manualCreateResponse.status, 404);
  } finally {
    await closeServer(server);
    database.close();
  }
});
