import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { openDatabase } from "../../database/database.js";
import { HttpError } from "../../errors/httpError.js";
import { ImageCacheRepository } from "./imageCacheRepository.js";
import { ImageCacheService } from "./imageCacheService.js";

const pngBytes = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);

test("downloads a validated image and revalidates the local copy", async () => {
  const database = openDatabase(":memory:");
  const cacheDirectory = await mkdtemp(join(tmpdir(), "backlog-images-"));
  const requests: RequestInit[] = [];
  const responses = [
    new Response(pngBytes, {
      status: 200,
      headers: {
        "content-type": "image/png",
        etag: '"cover-v1"',
      },
    }),
    new Response(null, { status: 304 }),
  ];

  const service = new ImageCacheService(
    new ImageCacheRepository(database),
    cacheDirectory,
    async (_input, init) => {
      requests.push(init ?? {});

      const response = responses.shift();

      if (response === undefined) {
        throw new Error("Unexpected image request.");
      }

      return response;
    },
  );

  try {
    const registered = service.register({
      provider: "igdb",
      sourceKey: "cover:co123",
      sourceUrl:
        "https://images.igdb.com/igdb/image/upload/t_cover_big/co123.png",
    });

    const downloaded = await service.refresh(registered.id);

    assert.equal(downloaded.status, "downloaded");
    assert.equal(downloaded.image.contentType, "image/png");
    assert.equal(downloaded.image.byteSize, pngBytes.byteLength);
    assert.notEqual(downloaded.image.fileName, null);

    const storedBytes = await readFile(
      join(cacheDirectory, downloaded.image.fileName ?? ""),
    );

    assert.deepEqual(storedBytes, Buffer.from(pngBytes));

    const unchanged = await service.refresh(registered.id);

    assert.equal(unchanged.status, "not_modified");
    assert.equal(unchanged.image.fileName, downloaded.image.fileName);

    const secondHeaders = new Headers(requests[1]?.headers);

    assert.equal(secondHeaders.get("if-none-match"), '"cover-v1"');
  } finally {
    database.close();
    await rm(cacheDirectory, { recursive: true, force: true });
  }
});

test("rejects unapproved hosts before making a request", async () => {
  const database = openDatabase(":memory:");
  let requestCount = 0;

  const service = new ImageCacheService(
    new ImageCacheRepository(database),
    tmpdir(),
    async () => {
      requestCount += 1;
      return new Response(pngBytes);
    },
  );

  try {
    assert.throws(
      () =>
        service.register({
          provider: "igdb",
          sourceKey: "unsafe",
          sourceUrl: "https://example.com/not-igdb.png",
        }),
      (error: unknown) =>
        error instanceof HttpError && error.code === "invalid_image_source",
    );

    assert.equal(requestCount, 0);
  } finally {
    database.close();
  }
});

test("keeps the existing local copy when a refresh fails validation", async () => {
  const database = openDatabase(":memory:");
  const cacheDirectory = await mkdtemp(join(tmpdir(), "backlog-images-"));
  const responses = [
    new Response(pngBytes, {
      status: 200,
      headers: { "content-type": "image/png" },
    }),
    new Response("not an image", {
      status: 200,
      headers: { "content-type": "image/png" },
    }),
  ];

  const service = new ImageCacheService(
    new ImageCacheRepository(database),
    cacheDirectory,
    async () => {
      const response = responses.shift();

      if (response === undefined) {
        throw new Error("Unexpected image request.");
      }

      return response;
    },
  );

  try {
    const registered = service.register({
      provider: "playstation",
      sourceKey: "NPWR00001_00:icon",
      sourceUrl: "https://image.api.playstation.com/example/icon.png",
    });

    const firstRefresh = await service.refresh(registered.id);

    await assert.rejects(
      service.refresh(registered.id),
      (error: unknown) =>
        error instanceof HttpError && error.code === "invalid_image_file",
    );

    const preserved = new ImageCacheRepository(database).findById(
      registered.id,
    );

    assert.equal(preserved?.fileName, firstRefresh.image.fileName);

    const storedBytes = await readFile(
      join(cacheDirectory, firstRefresh.image.fileName ?? ""),
    );

    assert.deepEqual(storedBytes, Buffer.from(pngBytes));
  } finally {
    database.close();
    await rm(cacheDirectory, { recursive: true, force: true });
  }
});

test("coalesces concurrent refreshes for the same image", async () => {
  const database = openDatabase(":memory:");
  const cacheDirectory = await mkdtemp(join(tmpdir(), "backlog-images-"));
  let releaseRequest: (() => void) | undefined;
  let requestCount = 0;

  const requestGate = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });

  const repository = new ImageCacheRepository(database);

  const service = new ImageCacheService(
    repository,
    cacheDirectory,
    async () => {
      requestCount += 1;

      await requestGate;

      return new Response(pngBytes, {
        status: 200,
        headers: {
          "content-type": "image/png",
        },
      });
    },
  );

  try {
    const registered = service.register({
      provider: "igdb",
      sourceKey: "cover:co-concurrent",
      sourceUrl:
        "https://images.igdb.com/igdb/image/upload/t_cover_big/co-concurrent.png",
    });

    const firstRefresh = service.refresh(registered.id);
    const secondRefresh = service.refresh(registered.id);

    assert.equal(firstRefresh, secondRefresh);

    releaseRequest?.();

    const [firstResult, secondResult] = await Promise.all([
      firstRefresh,
      secondRefresh,
    ]);

    assert.equal(requestCount, 1);
    assert.equal(firstResult.image.id, registered.id);
    assert.equal(secondResult.image.id, registered.id);
  } finally {
    database.close();
    await rm(cacheDirectory, { recursive: true, force: true });
  }
});

test("limits image downloading to four concurrent refreshes", async () => {
  const database = openDatabase(":memory:");
  const cacheDirectory = await mkdtemp(join(tmpdir(), "backlog-images-"));

  let activeRequests = 0;
  let maximumActiveRequests = 0;
  let startedRequests = 0;
  let releaseRequests: (() => void) | undefined;
  let notifyFourStarted: (() => void) | undefined;

  const requestGate = new Promise<void>((resolve) => {
    releaseRequests = resolve;
  });

  const fourStarted = new Promise<void>((resolve) => {
    notifyFourStarted = resolve;
  });

  const service = new ImageCacheService(
    new ImageCacheRepository(database),
    cacheDirectory,
    async () => {
      activeRequests += 1;
      startedRequests += 1;

      maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);

      if (startedRequests === 4) {
        notifyFourStarted?.();
      }

      await requestGate;

      activeRequests -= 1;

      return new Response(pngBytes, {
        status: 200,
        headers: {
          "content-type": "image/png",
        },
      });
    },
  );

  try {
    const images = Array.from({ length: 6 }, (_, index) =>
      service.register({
        provider: "igdb",
        sourceKey: `cover:concurrency-${index}`,
        sourceUrl:
          `https://images.igdb.com/igdb/image/upload/` +
          `t_cover_big/concurrency-${index}.png`,
      }),
    );

    const refreshes = images.map((image) => service.refresh(image.id));

    await fourStarted;

    assert.equal(activeRequests, 4);
    assert.equal(startedRequests, 4);

    releaseRequests?.();

    await Promise.all(refreshes);

    assert.equal(maximumActiveRequests, 4);
    assert.equal(startedRequests, 6);
  } finally {
    releaseRequests?.();

    database.close();

    await rm(cacheDirectory, {
      recursive: true,
      force: true,
    });
  }
});

test("invalidates provider validators when a registered source URL changes", () => {
  const database = openDatabase(":memory:");
  const repository = new ImageCacheRepository(database);

  try {
    const registered = repository.register({
      provider: "igdb",
      sourceKey: "cover:co-resized",
      sourceUrl:
        "https://images.igdb.com/igdb/image/upload/t_cover_big/co-resized.jpg",
    });

    repository.markStored({
      imageId: registered.id,
      fileName: "existing-cover.jpg",
      contentType: "image/jpeg",
      byteSize: 3,
      etag: '"old-cover"',
      lastModified: "Wed, 26 Aug 2026 12:00:00 GMT",
      timestamp: "2026-08-26T12:00:00.000Z",
    });

    const updated = repository.register({
      provider: "igdb",
      sourceKey: "cover:co-resized",
      sourceUrl:
        "https://images.igdb.com/igdb/image/upload/t_1080p/co-resized.jpg",
    });

    assert.equal(updated.id, registered.id);
    assert.equal(updated.fileName, "existing-cover.jpg");
    assert.equal(updated.etag, null);
    assert.equal(updated.lastModified, null);
    assert.equal(updated.lastCheckedAt, null);
  } finally {
    database.close();
  }
});
