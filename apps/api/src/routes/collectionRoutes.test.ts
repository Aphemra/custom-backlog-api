import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { createApp } from "../app.js";
import { openDatabase } from "../database/database.js";
import type { CollectionDetail } from "../features/collections/collectionTypes.js";
import type { LibraryGame } from "../features/library/libraryGameTypes.js";

interface CollectionResponse {
  collection: CollectionDetail;
}

interface CollectionsResponse {
  collections: CollectionDetail[];
}

interface GameResponse {
  game: LibraryGame;
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

test("exposes collection management through the local API", async () => {
  const database = openDatabase(":memory:");
  const server = createApp(database).listen(0, "127.0.0.1");

  try {
    await once(server, "listening");

    const address = server.address() as AddressInfo;
    const apiUrl = `http://127.0.0.1:${address.port}/api`;

    const gameResponse = await fetch(`${apiUrl}/library/games`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Astro Bot",
        platform: "PS5",
      }),
    });

    const createdGame = (await gameResponse.json()) as GameResponse;

    const createResponse = await fetch(`${apiUrl}/collections`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Platformers",
      }),
    });

    assert.equal(createResponse.status, 201);

    const created = (await createResponse.json()) as CollectionResponse;

    const fillResponse = await fetch(
      `${apiUrl}/collections/${created.collection.id}/games`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          orderedGameIds: [createdGame.game.id],
        }),
      },
    );

    const filled = (await fillResponse.json()) as CollectionResponse;

    assert.equal(filled.collection.gameCount, 1);
    assert.equal(filled.collection.games[0]?.id, createdGame.game.id);

    const updateResponse = await fetch(
      `${apiUrl}/collections/${created.collection.id}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          description: "Favorites",
        }),
      },
    );

    const updated = (await updateResponse.json()) as CollectionResponse;

    assert.equal(updated.collection.description, "Favorites");

    const listResponse = await fetch(`${apiUrl}/collections`);

    const listed = (await listResponse.json()) as CollectionsResponse;

    assert.equal(listed.collections.length, 1);
    assert.equal(listed.collections[0]?.gameCount, 1);

    const invalidMembershipResponse = await fetch(
      `${apiUrl}/collections/${created.collection.id}/games`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          orderedGameIds: ["missing-game"],
        }),
      },
    );

    assert.equal(invalidMembershipResponse.status, 409);

    const deleteResponse = await fetch(
      `${apiUrl}/collections/${created.collection.id}`,
      {
        method: "DELETE",
      },
    );

    assert.equal(deleteResponse.status, 204);

    assert.equal(
      (await fetch(`${apiUrl}/library/games/${createdGame.game.id}`)).status,
      200,
    );
  } finally {
    await closeServer(server);
    database.close();
  }
});
