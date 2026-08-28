import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createApp } from "../app.js";
import { openDatabase } from "../database/database.js";
import { ImageCacheRepository } from "../features/imageCache/imageCacheRepository.js";

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

test("serves a cached image without contacting its external source", async () => {
  const database = openDatabase(":memory:");
  const cacheDirectory = await mkdtemp(join(tmpdir(), "backlog-images-"));
  const repository = new ImageCacheRepository(database);
  const image = repository.register({
    provider: "igdb",
    sourceKey: "cover:co123",
    sourceUrl:
      "https://images.igdb.com/igdb/image/upload/t_cover_big/co123.png",
  });

  const fileName = "local-test-cover.png";
  const bytes = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
  ]);

  await writeFile(join(cacheDirectory, fileName), bytes);

  repository.markStored({
    imageId: image.id,
    fileName,
    contentType: "image/png",
    byteSize: bytes.byteLength,
    etag: null,
    lastModified: null,
    timestamp: new Date().toISOString(),
  });

  const server = createApp(database, cacheDirectory).listen(0, "127.0.0.1");

  try {
    await once(server, "listening");

    const address = server.address() as AddressInfo;
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/images/${image.id}`,
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/png");
    assert.equal(
      response.headers.get("cache-control"),
      "private, max-age=3600",
    );
    assert.deepEqual(
      Buffer.from(await response.arrayBuffer()),
      Buffer.from(bytes),
    );
  } finally {
    await closeServer(server);
    database.close();
    await rm(cacheDirectory, { recursive: true, force: true });
  }
});

test("serves stale local images before revalidating them in the background", async () => {
  const database = openDatabase(":memory:");
  const cacheDirectory = await mkdtemp(join(tmpdir(), "backlog-images-"));
  const repository = new ImageCacheRepository(database);
  const refreshEvents = new EventEmitter();
  const imageRequests: RequestInit[] = [];

  const image = repository.register({
    provider: "igdb",
    sourceKey: "cover:co-stale",
    sourceUrl:
      "https://images.igdb.com/igdb/image/upload/t_cover_big/co-stale.png",
  });

  const fileName = "stale-local-cover.png";
  const bytes = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
  ]);

  await writeFile(join(cacheDirectory, fileName), bytes);

  const staleTimestamp = "2025-01-01T00:00:00.000Z";

  repository.markStored({
    imageId: image.id,
    fileName,
    contentType: "image/png",
    byteSize: bytes.byteLength,
    etag: '"stale-cover"',
    lastModified: null,
    timestamp: staleTimestamp,
  });

  const server = createApp(
    database,
    cacheDirectory,
    {
      clientId: "test-client",
      clientSecret: "test-secret",
    },
    async (_input, init) => {
      imageRequests.push(init ?? {});
      refreshEvents.emit("started");

      return new Response(null, {
        status: 304,
      });
    },
  ).listen(0, "127.0.0.1");

  try {
    await once(server, "listening");

    const refreshStarted = once(refreshEvents, "started");
    const address = server.address() as AddressInfo;

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/images/${image.id}`,
    );

    assert.equal(response.status, 200);

    assert.deepEqual(
      Buffer.from(await response.arrayBuffer()),
      Buffer.from(bytes),
    );

    await refreshStarted;
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.equal(imageRequests.length, 1);

    const headers = new Headers(imageRequests[0]?.headers);

    assert.equal(headers.get("if-none-match"), '"stale-cover"');

    const revalidated = repository.findById(image.id);

    assert.notEqual(revalidated?.lastCheckedAt, staleTimestamp);
    assert.equal(revalidated?.fileName, fileName);
  } finally {
    await closeServer(server);
    database.close();
    await rm(cacheDirectory, { recursive: true, force: true });
  }
});
