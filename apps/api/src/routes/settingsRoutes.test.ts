import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createApp } from "../app.js";
import { openDatabase } from "../database/database.js";

interface PlayStationSettingsResponse {
  readonly settings: {
    readonly readerOnlineId: string | null;
    readonly targetOnlineId: string | null;
    readonly hasNpsso: boolean;
    readonly npssoUpdatedAt: string | null;
    readonly npssoExpectedRenewalAt: string | null;
    readonly renewalReminderDays: number;
  };
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

test("stores PlayStation credentials without exposing the NPSSO", async () => {
  const database = openDatabase(":memory:");

  const directory = await mkdtemp(
    join(tmpdir(), "trophy-backlog-settings-routes-"),
  );

  const server = createApp(
    database,
    join(directory, "images"),
    {
      clientId: null,
      clientSecret: null,
    },
    fetch,
    {},
    join(directory, "credentials.key"),
  ).listen(0, "127.0.0.1");

  const npsso = "n".repeat(64);

  try {
    await once(server, "listening");

    const address = server.address() as AddressInfo;
    const apiUrl = `http://127.0.0.1:${address.port}/api/settings/playstation`;

    const initialResponse = await fetch(apiUrl);
    const initial =
      (await initialResponse.json()) as PlayStationSettingsResponse;

    assert.deepEqual(initial.settings, {
      readerOnlineId: null,
      targetOnlineId: null,
      hasNpsso: false,
      npssoUpdatedAt: null,
      npssoExpectedRenewalAt: null,
      renewalReminderDays: 7,
    });

    const updateResponse = await fetch(apiUrl, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        readerOnlineId: "BacklogReader",
        targetOnlineId: "MainAccount",
        readerNpsso: npsso,
        renewalReminderDays: 10,
      }),
    });

    assert.equal(updateResponse.status, 200);

    const responseText = await updateResponse.text();

    assert.equal(responseText.includes(npsso), false);

    const updated = JSON.parse(responseText) as PlayStationSettingsResponse;

    assert.equal(updated.settings.hasNpsso, true);
    assert.equal(updated.settings.readerOnlineId, "BacklogReader");
    assert.equal(updated.settings.targetOnlineId, "MainAccount");
    assert.equal(updated.settings.renewalReminderDays, 10);

    const duplicateResponse = await fetch(apiUrl, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        targetOnlineId: "backlogreader",
      }),
    });

    assert.equal(duplicateResponse.status, 400);
  } finally {
    await closeServer(server);
    database.close();

    await rm(directory, {
      recursive: true,
      force: true,
    });
  }
});
