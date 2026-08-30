import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createApp } from "./app.js";
import { openDatabase } from "./database/database.js";

test("serves the production web application without replacing API fallbacks", async () => {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "trophy-backlog-web-"),
  );
  const webDirectory = join(temporaryDirectory, "web");
  const assetsDirectory = join(webDirectory, "assets");
  const indexDocument =
    "<!doctype html><html><body>Trophy Backlog</body></html>";

  await mkdir(assetsDirectory, {
    recursive: true,
  });
  await writeFile(join(webDirectory, "index.html"), indexDocument);
  await writeFile(
    join(assetsDirectory, "application.js"),
    "globalThis.trophyBacklogLoaded = true;",
  );

  const database = openDatabase(":memory:");
  const app = createApp(
    database,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    webDirectory,
  );
  const server = app.listen(0, "127.0.0.1");

  try {
    await once(server, "listening");

    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const rootResponse = await fetch(baseUrl);
    assert.equal(rootResponse.status, 200);
    assert.equal(await rootResponse.text(), indexDocument);
    assert.equal(rootResponse.headers.get("cache-control"), "no-cache");

    const browserRouteResponse = await fetch(`${baseUrl}/library/history`);
    assert.equal(browserRouteResponse.status, 200);
    assert.equal(await browserRouteResponse.text(), indexDocument);

    const assetResponse = await fetch(`${baseUrl}/assets/application.js`);
    assert.equal(assetResponse.status, 200);
    assert.equal(
      await assetResponse.text(),
      "globalThis.trophyBacklogLoaded = true;",
    );

    const missingApiResponse = await fetch(`${baseUrl}/api/not-a-real-route`);
    assert.equal(missingApiResponse.status, 404);
    assert.deepEqual(await missingApiResponse.json(), {
      ok: false,
      error: "api_route_not_found",
    });
  } finally {
    await new Promise<void>((resolveClose, rejectClose) => {
      server.close((error) => {
        if (error !== undefined) {
          rejectClose(error);
          return;
        }

        resolveClose();
      });
    });

    database.close();
    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  }
});
