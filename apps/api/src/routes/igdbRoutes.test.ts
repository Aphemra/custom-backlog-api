import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createApp } from "../app.js";
import { openDatabase } from "../database/database.js";
import type { IgdbGameSearchResult } from "../features/igdb/igdbTypes.js";

interface SearchResponse {
  games: IgdbGameSearchResult[];
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

function readUrl(input: string | URL | Request): string {
  return input instanceof Request ? input.url : input.toString();
}

test("searches IGDB and lazily stores its artwork in the local cache", async () => {
  const database = openDatabase(":memory:");
  const cacheDirectory = await mkdtemp(join(tmpdir(), "backlog-igdb-"));

  const requestCounts = {
    authentication: 0,
    games: 0,
    images: 0,
  };

  const externalFetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = readUrl(input);

    if (url === "https://id.twitch.tv/oauth2/token") {
      requestCounts.authentication += 1;

      assert.match(String(init?.body), /client_id=test-client/);
      assert.match(String(init?.body), /client_secret=test-secret/);

      return Response.json({
        access_token: "test-access-token",
        expires_in: 3_600,
        token_type: "bearer",
      });
    }

    if (url === "https://api.igdb.com/v4/games") {
      requestCounts.games += 1;

      const headers = new Headers(init?.headers);
      const query = String(init?.body);

      assert.equal(headers.get("client-id"), "test-client");
      assert.equal(headers.get("authorization"), "Bearer test-access-token");
      assert.match(query, /search "Astro";/);

      if (requestCounts.games === 1) {
        assert.match(query, /platforms = \(9,48,167\)/);
      } else {
        assert.match(query, /platforms = \(167\)/);
      }

      if (query.includes("game_type = (1)")) {
        return Response.json([
          {
            id: 350766,
            name: "Astro Bot: Costume Pack",
            game_type: 1,
            platforms: [{ id: 167 }],
          },
        ]);
      }

      assert.match(query, /game_type != \(1,2,3,5,12,13,14\)/);

      return Response.json([
        {
          id: 250766,
          name: "Astro Bot",
          game_type: 0,
          summary: "A platforming adventure.",
          platforms: [{ id: 48 }, { id: 167 }],
          release_dates: [{ date: 1_725_580_800, platform: 167 }],
          cover: { image_id: "co8abc" },
          screenshots: [
            {
              image_id: "sc8abc",
              width: 1920,
              height: 1080,
            },
          ],
        },
      ]);
    }

    if (
      url ===
      "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co8abc.jpg"
    ) {
      requestCounts.images += 1;

      return new Response(Uint8Array.from([0xff, 0xd8, 0xff, 0x00]), {
        headers: { "content-type": "image/jpeg" },
      });
    }

    if (
      url === "https://images.igdb.com/igdb/image/upload/t_1080p/sc8abc.jpg"
    ) {
      requestCounts.images += 1;

      return new Response(Uint8Array.from([0xff, 0xd8, 0xff, 0x01]), {
        headers: { "content-type": "image/jpeg" },
      });
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
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const searchResponse = await fetch(
      `${baseUrl}/api/integrations/igdb/games?query=Astro`,
    );

    assert.equal(searchResponse.status, 200);

    const search = (await searchResponse.json()) as SearchResponse;

    assert.equal(search.games.length, 1);
    assert.equal(search.games[0]?.isDlc, false);
    assert.deepEqual(search.games[0]?.platforms, ["PS4", "PS5"]);
    assert.equal(search.games[0]?.releaseDate, "2024-09-06");
    assert.match(search.games[0]?.cover?.url ?? "", /^\/api\/images\//);

    assert.deepEqual(requestCounts, {
      authentication: 1,
      games: 1,
      images: 0,
    });

    const coverUrl = search.games[0]?.cover?.url;

    assert.notEqual(coverUrl, undefined);
    assert.notEqual(coverUrl, null);

    const firstCoverResponse = await fetch(`${baseUrl}${coverUrl}`);

    assert.equal(firstCoverResponse.status, 200);
    assert.equal(firstCoverResponse.headers.get("content-type"), "image/jpeg");

    const secondCoverResponse = await fetch(`${baseUrl}${coverUrl}`);

    assert.equal(secondCoverResponse.status, 200);

    assert.deepEqual(requestCounts, {
      authentication: 1,
      games: 1,
      images: 1,
    });

    const screenshotImageId = search.games[0]?.screenshots[0]?.imageId;

    assert.notEqual(screenshotImageId, undefined);

    const firstScreenshotResponse = await fetch(
      `${baseUrl}/api/images/${screenshotImageId}`,
    );

    assert.equal(firstScreenshotResponse.status, 200);
    assert.equal(
      firstScreenshotResponse.headers.get("content-type"),
      "image/jpeg",
    );

    const secondScreenshotResponse = await fetch(
      `${baseUrl}/api/images/${screenshotImageId}`,
    );

    assert.equal(secondScreenshotResponse.status, 200);

    assert.deepEqual(requestCounts, {
      authentication: 1,
      games: 1,
      images: 2,
    });

    const searchWithDlcResponse = await fetch(
      `${baseUrl}/api/integrations/igdb/games?query=Astro` +
        "&platform=PS5&scope=dlc",
    );

    assert.equal(searchWithDlcResponse.status, 200);

    const searchWithDlc =
      (await searchWithDlcResponse.json()) as SearchResponse;

    assert.deepEqual(
      searchWithDlc.games.map((game) => ({
        title: game.title,
        isDlc: game.isDlc,
      })),
      [
        { title: "Astro Bot", isDlc: false },
        { title: "Astro Bot: Costume Pack", isDlc: true },
      ],
    );

    assert.deepEqual(requestCounts, {
      authentication: 1,
      games: 3,
      images: 2,
    });
  } finally {
    await closeServer(server);
    database.close();
    await rm(cacheDirectory, { recursive: true, force: true });
  }
});

test("reports missing IGDB credentials without making an external request", async () => {
  const database = openDatabase(":memory:");
  const cacheDirectory = await mkdtemp(join(tmpdir(), "backlog-igdb-"));
  let externalRequestMade = false;

  const server = createApp(
    database,
    cacheDirectory,
    {
      clientId: null,
      clientSecret: null,
    },
    async () => {
      externalRequestMade = true;
      throw new Error("No external request should be made.");
    },
  ).listen(0, "127.0.0.1");

  try {
    await once(server, "listening");

    const address = server.address() as AddressInfo;

    const invalidPlatformResponse = await fetch(
      `http://127.0.0.1:${address.port}/api/integrations/igdb/games` +
        "?query=Astro&platform=Vita",
    );

    assert.equal(invalidPlatformResponse.status, 400);

    assert.deepEqual(await invalidPlatformResponse.json(), {
      ok: false,
      error: "invalid_igdb_platform",
      message: "platform must be all, PS3, PS4, or PS5.",
    });

    const invalidScopeResponse = await fetch(
      `http://127.0.0.1:${address.port}/api/integrations/igdb/games` +
        "?query=Astro&scope=mods",
    );

    assert.equal(invalidScopeResponse.status, 400);

    assert.deepEqual(await invalidScopeResponse.json(), {
      ok: false,
      error: "invalid_igdb_search_scope",
      message: "scope is not a supported IGDB search scope.",
    });

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/integrations/igdb/games?query=Astro`,
    );

    assert.equal(response.status, 503);

    assert.deepEqual(await response.json(), {
      ok: false,
      error: "igdb_not_configured",
      message: "IGDB credentials have not been configured on the local API.",
    });

    assert.equal(externalRequestMade, false);
  } finally {
    await closeServer(server);
    database.close();
    await rm(cacheDirectory, { recursive: true, force: true });
  }
});
