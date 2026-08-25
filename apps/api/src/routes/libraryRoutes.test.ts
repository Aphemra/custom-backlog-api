import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { createApp } from "../app.js";
import { openDatabase } from "../database/database.js";
import type { LibraryGame } from "../features/library/libraryGameTypes.js";

interface GameResponse {
  game: LibraryGame;
}

interface GamesResponse {
  games: LibraryGame[];
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

test("exposes library CRUD through the local API", async () => {
  const database = openDatabase(":memory:");

  const server = createApp(database).listen(0, "127.0.0.1");

  try {
    await once(server, "listening");

    const address = server.address() as AddressInfo;

    const baseUrl = `http://127.0.0.1:${address.port}/api/library`;

    const createResponse = await fetch(`${baseUrl}/games`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Astro Bot",
        platform: "PS5",
      }),
    });

    assert.equal(createResponse.status, 201);

    const created = (await createResponse.json()) as GameResponse;

    assert.equal(created.game.title, "Astro Bot");

    const updateResponse = await fetch(`${baseUrl}/games/${created.game.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        pursuitStatus: "in_progress",
      }),
    });

    assert.equal(updateResponse.status, 200);

    const updated = (await updateResponse.json()) as GameResponse;

    assert.equal(updated.game.pursuitStatus, "in_progress");

    const listResponse = await fetch(`${baseUrl}/games`);

    const listed = (await listResponse.json()) as GamesResponse;

    assert.equal(listed.games.length, 1);

    assert.equal(listed.games[0]?.id, created.game.id);

    const invalidResponse = await fetch(`${baseUrl}/games`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Unsupported",
        platform: "Vita",
      }),
    });

    assert.equal(invalidResponse.status, 400);

    assert.deepEqual(await invalidResponse.json(), {
      ok: false,
      error: "invalid_platform",
      message: "platform must be PS3, PS4, or PS5.",
    });
  } finally {
    await closeServer(server);
    database.close();
  }
});
