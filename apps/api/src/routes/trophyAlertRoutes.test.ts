import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { createApp } from "../app.js";
import { openDatabase } from "../database/database.js";
import { LibraryGameRepository } from "../features/library/libraryGameRepository.js";
import type {
  TrophyAlert,
  TrophyAlertCounts,
} from "../features/alerts/trophyAlertTypes.js";

interface AlertsResponse {
  alerts: TrophyAlert[];
}

interface AlertResponse {
  alert: TrophyAlert;
}

interface AlertCountsResponse {
  counts: TrophyAlertCounts;
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

test("lists, summarizes, and updates trophy alerts", async () => {
  const database = openDatabase(":memory:");

  const game = new LibraryGameRepository(database).create({
    title: "Expandable Trophy Game",
    platform: "PS5",
  });

  const capturedAt = "2026-08-27T12:00:00.000Z";

  database
    .prepare(
      `
      INSERT INTO trophy_snapshots (
        id,
        game_id,
        sync_run_id,
        captured_at,
        bronze_total,
        silver_total,
        gold_total,
        platinum_total,
        bronze_earned,
        silver_earned,
        gold_earned,
        platinum_earned,
        progress_percent,
        is_100_percent,
        has_platinum,
        payload_json
      ) VALUES (
        ?, ?, NULL, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, NULL
      )
    `,
    )
    .run(
      "current-alert-snapshot",
      game.id,
      capturedAt,
      45,
      10,
      3,
      1,
      40,
      10,
      3,
      1,
      92,
      0,
      1,
    );

  database
    .prepare(
      `
      INSERT INTO trophy_alerts (
        id,
        game_id,
        kind,
        status,
        previous_snapshot_id,
        current_snapshot_id,
        details_json,
        created_at,
        resolved_at
      ) VALUES (
        ?, ?, 'completion_lost', 'unread',
        NULL, ?, ?, ?, NULL
      )
    `,
    )
    .run(
      "completion-lost-alert",
      game.id,
      "current-alert-snapshot",
      JSON.stringify({
        title: game.title,
        previousProgress: 100,
        currentProgress: 92,
        previousEarned: {
          bronze: 40,
          silver: 10,
          gold: 3,
          platinum: 1,
        },
        currentEarned: {
          bronze: 40,
          silver: 10,
          gold: 3,
          platinum: 1,
        },
      }),
      capturedAt,
    );

  const server = createApp(database).listen(0, "127.0.0.1");

  try {
    await once(server, "listening");

    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api/trophy-alerts`;

    const listResponse = await fetch(`${baseUrl}?status=unread`);

    assert.equal(listResponse.status, 200);

    const listed = (await listResponse.json()) as AlertsResponse;

    assert.equal(listed.alerts.length, 1);
    assert.equal(listed.alerts[0]?.kind, "completion_lost");
    assert.equal(listed.alerts[0]?.game.title, game.title);
    assert.equal(listed.alerts[0]?.currentProgressPercent, 92);

    const summaryResponse = await fetch(`${baseUrl}/summary`);

    assert.equal(summaryResponse.status, 200);

    const summary = (await summaryResponse.json()) as AlertCountsResponse;

    assert.deepEqual(summary.counts, {
      total: 1,
      unread: 1,
      unreadNewTrophies: 0,
      unreadCompletionLost: 1,
    });

    const updateResponse = await fetch(`${baseUrl}/completion-lost-alert`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        status: "read",
      }),
    });

    assert.equal(updateResponse.status, 200);

    const updated = (await updateResponse.json()) as AlertResponse;

    assert.equal(updated.alert.status, "read");
    assert.equal(updated.alert.resolvedAt, null);

    const invalidResponse = await fetch(`${baseUrl}/completion-lost-alert`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        status: "deleted",
      }),
    });

    assert.equal(invalidResponse.status, 400);
  } finally {
    await closeServer(server);
    database.close();
  }
});
