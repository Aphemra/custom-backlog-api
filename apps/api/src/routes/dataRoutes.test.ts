import assert from "node:assert/strict";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import express from "express";
import { openDatabase } from "../database/database.js";
import { LibraryGameRepository } from "../features/library/libraryGameRepository.js";
import type { BacklogDeletionResult } from "../features/backlog/backlogMaintenanceService.js";
import type { PortableImportResult } from "../features/portableData/portableDataService.js";
import type { PortableDataExport } from "../features/portableData/portableDataTypes.js";
import { createDataRoutes } from "./dataRoutes.js";

async function closeServer(
  server: ReturnType<ReturnType<typeof express>["listen"]>,
) {
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

test("exposes portable export, preview, and import through the local API", async () => {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "trophy-backlog-data-routes-test-"),
  );

  const backupDirectory = join(temporaryDirectory, "backups");

  const database = openDatabase(join(temporaryDirectory, "database.sqlite"));

  const games = new LibraryGameRepository(database);

  games.create({
    title: "Astro Bot",
    platform: "PS5",
  });

  const app = express();

  app.use(
    express.json({
      limit: "25mb",
    }),
  );

  app.use("/api/data", createDataRoutes(database, backupDirectory));

  const server = app.listen(0, "127.0.0.1");

  try {
    await once(server, "listening");

    const address = server.address() as AddressInfo;

    const baseUrl = `http://127.0.0.1:${address.port}` + "/api/data";

    const exportResponse = await fetch(`${baseUrl}/export`);

    assert.equal(exportResponse.status, 200);

    assert.match(
      exportResponse.headers.get("content-disposition") ?? "",
      /^attachment; filename="trophy-backlog-.+\.json"$/,
    );

    const portableData = (await exportResponse.json()) as PortableDataExport;

    const previewResponse = await fetch(`${baseUrl}/imports/preview`, {
      method: "POST",

      headers: {
        "content-type": "application/json",
      },

      body: JSON.stringify(portableData),
    });

    assert.equal(previewResponse.status, 200);

    const importResponse = await fetch(`${baseUrl}/imports`, {
      method: "POST",

      headers: {
        "content-type": "application/json",
      },

      body: JSON.stringify(portableData),
    });

    assert.equal(importResponse.status, 200);

    const result = (await importResponse.json()) as PortableImportResult;

    assert.equal(
      existsSync(join(backupDirectory, result.backup.fileName)),
      true,
    );

    assert.equal(result.incoming.libraryGames, 1);

    const deletionResponse = await fetch(`${baseUrl}/backlog`, {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        confirmation: "Delete Entire Backlog",
      }),
    });

    assert.equal(deletionResponse.status, 200);

    const deletionResult =
      (await deletionResponse.json()) as BacklogDeletionResult;

    assert.deepEqual(deletionResult.deleted, {
      libraryGames: 1,
      collections: 0,
      savedViews: 0,
    });

    assert.equal(
      existsSync(join(backupDirectory, deletionResult.backup.fileName)),
      true,
    );

    assert.equal(games.list().length, 0);
  } finally {
    await closeServer(server);
    database.close();

    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  }
});
