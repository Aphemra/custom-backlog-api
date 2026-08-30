import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { createApp } from "../app.js";
import { openDatabase } from "../database/database.js";
import { BacklogHistoryRepository } from "../features/history/backlogHistoryRepository.js";

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

test("exposes trophy and backlog history routes", async () => {
  const database = openDatabase(":memory:");

  new BacklogHistoryRepository(database).append({
    action: "backlog_imported",
    source: "portable_import",
    occurredAt: "2026-08-29T12:00:00.000Z",
    summary: "Imported a portable backlog containing 12 games.",
    details: {
      libraryGames: 12,
      collections: 2,
      savedViews: 1,
    },
  });

  const server = createApp(database).listen(0, "127.0.0.1");

  try {
    await once(server, "listening");

    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api/history`;

    const overviewResponse = await fetch(`${baseUrl}/overview`);

    assert.equal(overviewResponse.status, 200);

    const overview = (await overviewResponse.json()) as {
      summary: {
        earnedTrophyCount: number;
      };
      coverage: {
        isComplete: boolean | null;
      };
    };

    assert.equal(overview.summary.earnedTrophyCount, 0);
    assert.equal(overview.coverage.isComplete, null);

    const statisticsResponse = await fetch(`${baseUrl}/statistics`);

    assert.equal(statisticsResponse.status, 200);

    const statistics = (await statisticsResponse.json()) as {
      gamesRepresented: number;
      activeMonths: number;
      byPlatform: unknown[];
      byTrophyType: unknown[];
      monthlyActivity: unknown[];
    };

    assert.equal(statistics.gamesRepresented, 0);
    assert.equal(statistics.activeMonths, 0);
    assert.equal(statistics.byPlatform.length, 3);
    assert.equal(statistics.byTrophyType.length, 4);
    assert.deepEqual(statistics.monthlyActivity, []);

    const trophyResponse = await fetch(
      `${baseUrl}/trophies?page=1&pageSize=25&direction=desc`,
    );

    assert.equal(trophyResponse.status, 200);

    const trophies = (await trophyResponse.json()) as {
      trophies: unknown[];
      pagination: {
        page: number;
        pageSize: number;
        totalItems: number;
        totalPages: number;
      };
    };

    assert.deepEqual(trophies, {
      trophies: [],
      pagination: {
        page: 1,
        pageSize: 25,
        totalItems: 0,
        totalPages: 0,
      },
    });

    const milestoneResponse = await fetch(
      `${baseUrl}/milestones?kind=platinum_total`,
    );

    assert.equal(milestoneResponse.status, 200);

    const milestones = (await milestoneResponse.json()) as {
      milestones: unknown[];
    };

    assert.deepEqual(milestones, {
      milestones: [],
    });

    const backlogResponse = await fetch(
      `${baseUrl}/backlog?action=backlog_imported&source=portable_import&page=1&pageSize=25`,
    );

    assert.equal(backlogResponse.status, 200);

    const backlog = (await backlogResponse.json()) as {
      entries: Array<{
        action: string;
        source: string;
      }>;
      pagination: {
        page: number;
        pageSize: number;
        totalItems: number;
        totalPages: number;
      };
    };

    assert.equal(backlog.entries.length, 1);
    assert.equal(backlog.entries[0]?.action, "backlog_imported");
    assert.equal(backlog.entries[0]?.source, "portable_import");
    assert.deepEqual(backlog.pagination, {
      page: 1,
      pageSize: 25,
      totalItems: 1,
      totalPages: 1,
    });

    const invalidBacklogActionResponse = await fetch(
      `${baseUrl}/backlog?action=duct_taped`,
    );

    assert.equal(invalidBacklogActionResponse.status, 400);

    const invalidBacklogSourceResponse = await fetch(
      `${baseUrl}/backlog?source=psnprofiles`,
    );

    assert.equal(invalidBacklogSourceResponse.status, 400);

    const invalidPageResponse = await fetch(`${baseUrl}/trophies?page=0`);

    assert.equal(invalidPageResponse.status, 400);

    const invalidPlatformResponse = await fetch(
      `${baseUrl}/trophies?platform=PS2`,
    );

    assert.equal(invalidPlatformResponse.status, 400);

    const invalidMilestoneResponse = await fetch(
      `${baseUrl}/milestones?kind=rarity`,
    );

    assert.equal(invalidMilestoneResponse.status, 400);
  } finally {
    await closeServer(server);
    database.close();
  }
});
