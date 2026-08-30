import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { createApp } from "../app.js";
import { openDatabase } from "../database/database.js";
import { CollectionRepository } from "../features/collections/collectionRepository.js";
import { BacklogHistoryRepository } from "../features/history/backlogHistoryRepository.js";
import { LibraryGameRepository } from "../features/library/libraryGameRepository.js";

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

async function requireSuccessfulResponse(response: Response): Promise<void> {
  if (!response.ok) {
    throw new Error(
      `Expected a successful response but received ${response.status}.`,
    );
  }
}

test("records user-driven Library and Collection activity", async () => {
  const database = openDatabase(":memory:");
  const games = new LibraryGameRepository(database);
  const collections = new CollectionRepository(database);
  const history = new BacklogHistoryRepository(database);

  const game = games.create({
    title: "Persona 5",
    platform: "PS4",
    playStatus: "not_started",
    notes: null,
  });
  const collection = collections.create({
    name: "Persona",
    description: null,
  });

  const server = createApp(database).listen(0, "127.0.0.1");

  try {
    await once(server, "listening");

    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api`;

    await requireSuccessfulResponse(
      await fetch(`${baseUrl}/library/games/${game.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          playStatus: "playing",
        }),
      }),
    );

    await requireSuccessfulResponse(
      await fetch(`${baseUrl}/library/games/${game.id}/hide`, {
        method: "POST",
      }),
    );

    await requireSuccessfulResponse(
      await fetch(`${baseUrl}/collections/${collection.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Persona Series",
        }),
      }),
    );

    await requireSuccessfulResponse(
      await fetch(`${baseUrl}/collections/memberships/${game.id}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          collectionIds: [collection.id],
        }),
      }),
    );

    const activity = history.list({
      limit: 100,
    });

    assert.equal(activity.totalItems, 4);

    assert.deepEqual(
      new Set(activity.entries.map((entry) => entry.action)),
      new Set([
        "play_status_changed",
        "game_hidden",
        "collection_updated",
        "collection_membership_changed",
      ]),
    );

    const statusEntry = activity.entries.find(
      (entry) => entry.action === "play_status_changed",
    );

    assert.equal(statusEntry?.gameId, game.id);
    assert.equal(statusEntry?.previousPlayStatus, "not_started");
    assert.equal(statusEntry?.nextPlayStatus, "playing");
    assert.equal(statusEntry?.source, "user");

    const membershipEntry = activity.entries.find(
      (entry) => entry.action === "collection_membership_changed",
    );

    assert.equal(membershipEntry?.gameId, game.id);
    assert.equal(membershipEntry?.collectionId, collection.id);
    assert.equal(membershipEntry?.details.added, true);
  } finally {
    await closeServer(server);
    database.close();
  }
});
