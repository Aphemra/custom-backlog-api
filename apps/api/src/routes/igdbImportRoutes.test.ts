import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { createApp } from "../app.js";
import { openDatabase } from "../database/database.js";
import type { LibraryGame } from "../features/library/libraryGameTypes.js";
import { LibraryGameRepository } from "../features/library/libraryGameRepository.js";

interface GameResponse {
  game: LibraryGame;
}

interface CountRow {
  count: number;
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

function readCount(database: DatabaseSync, tableName: string): number {
  const allowedTables = new Set([
    "library_games",
    "external_game_metadata",
    "game_metadata_links",
    "cached_images",
    "library_game_images",
  ]);

  if (!allowedTables.has(tableName)) {
    throw new Error(`Unsupported test table: ${tableName}`);
  }

  const row = database
    .prepare(`SELECT COUNT(*) AS count FROM ${tableName}`)
    .get() as CountRow | undefined;

  return row?.count ?? 0;
}

test("atomically adds an IGDB result and its metadata to the library", async () => {
  const database = openDatabase(":memory:");
  const cacheDirectory = await mkdtemp(join(tmpdir(), "backlog-igdb-add-"));
  let tokenRequests = 0;
  let gameRequests = 0;

  const externalFetch = async (
    input: string | URL | Request,
  ): Promise<Response> => {
    const url = input instanceof Request ? input.url : input.toString();

    if (url === "https://id.twitch.tv/oauth2/token") {
      tokenRequests += 1;

      return Response.json({
        access_token: "test-access-token",
        expires_in: 3_600,
      });
    }

    if (url === "https://api.igdb.com/v4/games") {
      gameRequests += 1;

      return Response.json([
        {
          id: 250766,
          name: "Astro Bot",
          summary: "A platforming adventure.",
          platforms: [{ id: 167 }],
          release_dates: [{ date: 1_725_580_800, platform: 167 }],
          cover: { image_id: "co8abc" },
        },
      ]);
    }

    throw new Error(`Unexpected external request: ${url}`);
  };

  const server = createApp(
    database,
    cacheDirectory,
    {
      clientId: "test-client",
      clientSecret: "test-secret",
    },
    externalFetch,
  ).listen(0, "127.0.0.1");

  try {
    await once(server, "listening");

    const address = server.address() as AddressInfo;

    const endpoint =
      `http://127.0.0.1:${address.port}` +
      "/api/integrations/igdb/games/250766/library";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        platform: "PS5",
        pursuitStatus: "pursuing_soon",
      }),
    });

    assert.equal(response.status, 201);

    const created = (await response.json()) as GameResponse;

    assert.equal(created.game.title, "Astro Bot");
    assert.equal(created.game.platform, "PS5");
    assert.equal(created.game.pursuitStatus, "pursuing_soon");
    assert.equal(tokenRequests, 1);
    assert.equal(gameRequests, 1);
    assert.equal(readCount(database, "library_games"), 1);
    assert.equal(readCount(database, "external_game_metadata"), 1);
    assert.equal(readCount(database, "game_metadata_links"), 1);
    assert.equal(readCount(database, "cached_images"), 1);
    assert.equal(readCount(database, "library_game_images"), 1);

    const duplicateResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        platform: "PS5",
      }),
    });

    assert.equal(duplicateResponse.status, 409);
    assert.equal(readCount(database, "library_games"), 1);
    assert.equal(readCount(database, "external_game_metadata"), 1);
    assert.equal(tokenRequests, 1);
    assert.equal(gameRequests, 2);
  } finally {
    await closeServer(server);
    database.close();

    await rm(cacheDirectory, {
      recursive: true,
      force: true,
    });
  }
});

test("atomically enriches an existing library game without duplicating it", async () => {
  const database = openDatabase(":memory:");

  const cacheDirectory = await mkdtemp(join(tmpdir(), "backlog-igdb-enrich-"));

  const libraryGame = new LibraryGameRepository(database).create({
    title: "Astro Bot",
    platform: "PS5",
    pursuitStatus: "unplanned",
    notes: null,
  });

  let tokenRequests = 0;
  let gameRequests = 0;

  const externalFetch = async (
    input: string | URL | Request,
  ): Promise<Response> => {
    const url = input instanceof Request ? input.url : input.toString();

    if (url === "https://id.twitch.tv/oauth2/token") {
      tokenRequests += 1;

      return Response.json({
        access_token: "test-access-token",
        expires_in: 3_600,
      });
    }

    if (url === "https://api.igdb.com/v4/games") {
      gameRequests += 1;

      return Response.json([
        {
          id: 250766,
          name: "Astro Bot",
          summary: "A platforming adventure.",
          platforms: [{ id: 167 }],
          release_dates: [
            {
              date: 1_725_580_800,
              platform: 167,
            },
          ],
          cover: {
            image_id: "co8abc",
          },
        },
      ]);
    }

    throw new Error(`Unexpected external request: ${url}`);
  };

  const server = createApp(
    database,
    cacheDirectory,
    {
      clientId: "test-client",
      clientSecret: "test-secret",
    },
    externalFetch,
  ).listen(0, "127.0.0.1");

  try {
    await once(server, "listening");

    const address = server.address() as AddressInfo;

    const endpoint =
      `http://127.0.0.1:${address.port}` +
      `/api/integrations/igdb/games/250766/library/` +
      `${encodeURIComponent(libraryGame.id)}/metadata`;

    const rejectedResponse = await fetch(endpoint, {
      method: "POST",
    });

    assert.equal(rejectedResponse.status, 400);
    assert.equal(tokenRequests, 0);
    assert.equal(gameRequests, 0);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "x-trophy-backlog-action": "enrich-library-game-from-igdb",
      },
    });

    assert.equal(response.status, 200);

    const result = (await response.json()) as {
      game: LibraryGame;
      metadata: {
        provider: string;
        externalId: string;
        title: string;
        cover: {
          imageId: string;
          url: string;
        } | null;
      };
    };

    assert.equal(result.game.id, libraryGame.id);
    assert.equal(result.game.title, "Astro Bot");
    assert.equal(result.metadata.provider, "igdb");
    assert.equal(result.metadata.externalId, "250766");
    assert.equal(result.metadata.title, "Astro Bot");
    assert.match(
      result.metadata.cover?.url ?? "",
      /^\/api\/images\/[0-9a-f-]+$/,
    );

    assert.equal(tokenRequests, 1);
    assert.equal(gameRequests, 1);

    assert.equal(readCount(database, "library_games"), 1);
    assert.equal(readCount(database, "external_game_metadata"), 1);
    assert.equal(readCount(database, "game_metadata_links"), 1);
    assert.equal(readCount(database, "cached_images"), 1);
    assert.equal(readCount(database, "library_game_images"), 1);

    const duplicateResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "x-trophy-backlog-action": "enrich-library-game-from-igdb",
      },
    });

    assert.equal(duplicateResponse.status, 409);
    assert.equal(tokenRequests, 1);
    assert.equal(gameRequests, 1);
    assert.equal(readCount(database, "library_games"), 1);
  } finally {
    await closeServer(server);
    database.close();

    await rm(cacheDirectory, {
      recursive: true,
      force: true,
    });
  }
});
