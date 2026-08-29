import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createApp } from "../app.js";
import { openDatabase } from "../database/database.js";
import { LibraryGameRepository } from "../features/library/libraryGameRepository.js";
import type { PlayStationApiOperations } from "../features/playstation/playStationApi.js";
import { PlayStationRequestGate } from "../features/playstation/playStationRequestGate.js";
import { AppSettingsRepository } from "../features/settings/appSettingsRepository.js";

interface TestOperations {
  operations: PlayStationApiOperations;
  calls: string[];
}

interface Signal {
  promise: Promise<void>;
  resolve: () => void;
}

function createSignal(): Signal {
  let resolveSignal: (() => void) | undefined;

  const promise = new Promise<void>((resolve) => {
    resolveSignal = resolve;
  });

  return {
    promise,
    resolve() {
      resolveSignal?.();
    },
  };
}

function createOperations(
  beforeReturningTitles?: (requestNumber: number) => Promise<void>,
): TestOperations {
  const calls: string[] = [];
  let titleRequestCount = 0;

  const operations: PlayStationApiOperations = {
    async exchangeNpssoForAccessCode() {
      calls.push("exchange-npsso");
      return "access-code";
    },

    async exchangeAccessCodeForAuthTokens() {
      calls.push("exchange-code");

      return {
        accessToken: "access-token",
        expiresIn: 3_600,
        refreshToken: "refresh-token",
        refreshTokenExpiresIn: 7_200,
      };
    },

    async exchangeRefreshTokenForAuthTokens() {
      throw new Error("The cached access token should still be valid.");
    },

    async searchAccounts(_authorization, onlineId) {
      calls.push(`search:${onlineId}`);

      return {
        domainResponses: [
          {
            results: [
              {
                socialMetadata: {
                  accountId: "20002",
                  onlineId,
                },
              },
            ],
          },
        ],
      };
    },

    async getTrophySummary(_authorization, accountId) {
      calls.push(`summary:${accountId}`);

      return {
        accountId: accountId === "me" ? "10001" : accountId,
        trophyLevel: accountId === "me" ? 1 : 425,
        progress: 52,
        tier: accountId === "me" ? 1 : 5,
        earnedTrophies: {
          bronze: accountId === "me" ? 0 : 1_234,
          silver: accountId === "me" ? 0 : 456,
          gold: accountId === "me" ? 0 : 78,
          platinum: accountId === "me" ? 0 : 42,
        },
      };
    },

    async getTrophyTitles(_authorization, accountId, options) {
      titleRequestCount += 1;
      calls.push(`titles:${accountId}:${options.offset}`);

      await beforeReturningTitles?.(titleRequestCount);

      return {
        trophyTitles: [],
        totalItemCount: 0,
      };
    },
  };

  return { operations, calls };
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

function synchronizeFull(baseUrl: string): Promise<Response> {
  return fetch(`${baseUrl}/api/integrations/playstation/syncs`, {
    method: "POST",
    headers: {
      "x-trophy-backlog-action": "synchronize-playstation-trophies",
    },
  });
}

function synchronizeProgress(baseUrl: string): Promise<Response> {
  return fetch(`${baseUrl}/api/integrations/playstation/progress-syncs`, {
    method: "POST",
    headers: {
      "x-trophy-backlog-action": "synchronize-playstation-trophy-progress",
    },
  });
}

test("rejects a repeated sync before making another PlayStation request", async () => {
  const database = openDatabase(":memory:");
  const cacheDirectory = await mkdtemp(join(tmpdir(), "backlog-psn-cooldown-"));
  const { operations, calls } = createOperations();

  const server = createApp(
    database,
    cacheDirectory,
    { clientId: null, clientSecret: null },
    fetch,
    {
      credentials: {
        readerNpsso: "n".repeat(64),
        readerOnlineId: "BacklogReader",
        targetOnlineId: "MainAccount",
      },
      operations,
      requestGate: new PlayStationRequestGate({
        minimumIntervalMs: 0,
      }),
    },
  ).listen(0, "127.0.0.1");

  try {
    await once(server, "listening");

    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const firstResponse = await synchronizeProgress(baseUrl);

    assert.equal(firstResponse.status, 200);

    const callsAfterFirstSync = [...calls];
    const secondResponse = await synchronizeFull(baseUrl);

    assert.equal(secondResponse.status, 429);

    const secondBody = (await secondResponse.json()) as {
      ok: boolean;
      error: string;
      message: string;
      details: {
        retryAfterSeconds: number;
        nextAllowedAt: string;
      };
    };

    assert.equal(secondBody.ok, false);
    assert.equal(secondBody.error, "playstation_sync_cooldown_active");
    assert.ok(secondBody.details.retryAfterSeconds > 0);
    assert.ok(secondBody.details.retryAfterSeconds <= 300);
    assert.equal(
      secondBody.message,
      `PlayStation trophy synchronization is available again in ${
        secondBody.details.retryAfterSeconds
      } ${secondBody.details.retryAfterSeconds === 1 ? "second" : "seconds"}.`,
    );
    assert.ok(Date.parse(secondBody.details.nextAllowedAt) > Date.now());

    assert.deepEqual(calls, callsAfterFirstSync);
  } finally {
    await closeServer(server);
    database.close();

    await rm(cacheDirectory, {
      recursive: true,
      force: true,
    });
  }
});

test("rejects an overlapping sync without consuming another cooldown", async () => {
  const database = openDatabase(":memory:");
  const cacheDirectory = await mkdtemp(join(tmpdir(), "backlog-psn-lock-"));
  const titleRequestStarted = createSignal();
  const releaseTitleRequest = createSignal();

  const { operations, calls } = createOperations(async (requestNumber) => {
    if (requestNumber === 1) {
      titleRequestStarted.resolve();
      await releaseTitleRequest.promise;
    }
  });

  new AppSettingsRepository(database).update({
    trophySyncCooldownEnabled: false,
  });

  const server = createApp(
    database,
    cacheDirectory,
    { clientId: null, clientSecret: null },
    fetch,
    {
      credentials: {
        readerNpsso: "n".repeat(64),
        readerOnlineId: "BacklogReader",
        targetOnlineId: "MainAccount",
      },
      operations,
      requestGate: new PlayStationRequestGate({
        minimumIntervalMs: 0,
      }),
    },
  ).listen(0, "127.0.0.1");

  try {
    await once(server, "listening");

    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const firstResponsePromise = synchronizeProgress(baseUrl);

    await titleRequestStarted.promise;

    const runningProgressResponse = await fetch(
      `${baseUrl}/api/integrations/playstation/sync-progress`,
    );

    assert.equal(runningProgressResponse.status, 200);

    const runningProgressBody = (await runningProgressResponse.json()) as {
      progress: {
        status: string;
        operation: string | null;
        phase: string;
        startedAt: string | null;
        finishedAt: string | null;
      };
    };

    assert.equal(runningProgressBody.progress.status, "running");
    assert.equal(runningProgressBody.progress.operation, "progress");
    assert.equal(runningProgressBody.progress.phase, "fetching_titles");
    assert.notEqual(runningProgressBody.progress.startedAt, null);
    assert.equal(runningProgressBody.progress.finishedAt, null);

    const callsWhileFirstSyncIsActive = [...calls];
    const overlappingResponse = await synchronizeFull(baseUrl);

    assert.equal(overlappingResponse.status, 409);
    assert.deepEqual(await overlappingResponse.json(), {
      ok: false,
      error: "playstation_sync_in_progress",
      message: "A PlayStation trophy synchronization is already in progress.",
    });

    assert.deepEqual(calls, callsWhileFirstSyncIsActive);

    releaseTitleRequest.resolve();

    const firstResponse = await firstResponsePromise;

    assert.equal(firstResponse.status, 200);

    const completedProgressResponse = await fetch(
      `${baseUrl}/api/integrations/playstation/sync-progress`,
    );
    const completedProgressBody = (await completedProgressResponse.json()) as {
      progress: {
        status: string;
        phase: string;
        finishedAt: string | null;
      };
    };

    assert.equal(completedProgressBody.progress.status, "succeeded");
    assert.equal(completedProgressBody.progress.phase, "complete");
    assert.notEqual(completedProgressBody.progress.finishedAt, null);

    const replacementResponse = await synchronizeProgress(baseUrl);

    assert.equal(replacementResponse.status, 200);
    assert.equal(calls.filter((call) => call.startsWith("titles:")).length, 2);
  } finally {
    releaseTitleRequest.resolve();

    await closeServer(server);
    database.close();

    await rm(cacheDirectory, {
      recursive: true,
      force: true,
    });
  }
});

test("refreshes linked IGDB metadata only during a full synchronization", async () => {
  const database = openDatabase(":memory:");
  const cacheDirectory = await mkdtemp(
    join(tmpdir(), "backlog-psn-igdb-sync-"),
  );
  const { operations } = createOperations();

  const game = new LibraryGameRepository(database).create({
    title: "Astro Bot",
    platform: "PS5",
    playStatus: "not_started",
    notes: null,
  });

  const timestamp = "2026-08-29T12:00:00.000Z";

  database
    .prepare(
      `
      INSERT INTO external_game_metadata (
        id,
        provider,
        external_id,
        title,
        cover_url,
        release_date,
        payload_json,
        fetched_at
      ) VALUES (
        'metadata-astro',
        'igdb',
        '250766',
        'Old Astro Metadata',
        NULL,
        NULL,
        '{}',
        ?
      )
    `,
    )
    .run(timestamp);

  database
    .prepare(
      `
      INSERT INTO game_metadata_links (
        game_id,
        metadata_id,
        linked_at
      ) VALUES (?, 'metadata-astro', ?)
    `,
    )
    .run(game.id, timestamp);

  new AppSettingsRepository(database).update({
    trophySyncCooldownEnabled: false,
  });

  let igdbAuthenticationRequests = 0;
  let igdbGameRequests = 0;
  let igdbTimeRequests = 0;

  const externalFetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = input instanceof Request ? input.url : input.toString();

    if (url === "https://id.twitch.tv/oauth2/token") {
      igdbAuthenticationRequests += 1;

      return Response.json({
        access_token: "test-igdb-token",
        expires_in: 3_600,
      });
    }

    if (url === "https://api.igdb.com/v4/games") {
      igdbGameRequests += 1;

      assert.match(String(init?.body), /where id = 250766/);

      return Response.json([
        {
          id: 250766,
          name: "Current Astro Metadata",
          platforms: [{ id: 167 }],
          game_type: {
            id: 0,
            type: "Main Game",
          },
        },
      ]);
    }

    if (url === "https://api.igdb.com/v4/game_time_to_beats") {
      igdbTimeRequests += 1;

      return Response.json([]);
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
    {
      credentials: {
        readerNpsso: "n".repeat(64),
        readerOnlineId: "BacklogReader",
        targetOnlineId: "MainAccount",
      },
      operations,
      requestGate: new PlayStationRequestGate({
        minimumIntervalMs: 0,
      }),
    },
  ).listen(0, "127.0.0.1");

  try {
    await once(server, "listening");

    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const progressResponse = await synchronizeProgress(baseUrl);

    assert.equal(progressResponse.status, 200);
    assert.equal(igdbAuthenticationRequests, 0);
    assert.equal(igdbGameRequests, 0);
    assert.equal(igdbTimeRequests, 0);

    const fullResponse = await synchronizeFull(baseUrl);

    assert.equal(fullResponse.status, 200);

    const fullResult = (await fullResponse.json()) as {
      metadataRefresh: {
        expectedGameCount: number;
        refreshedGameCount: number;
        failedGameCount: number;
        skippedGameCount: number;
        stoppedEarly: boolean;
        failures: readonly unknown[];
      };
    };

    assert.deepEqual(fullResult.metadataRefresh, {
      expectedGameCount: 1,
      refreshedGameCount: 1,
      failedGameCount: 0,
      skippedGameCount: 0,
      stoppedEarly: false,
      failures: [],
    });

    assert.equal(igdbAuthenticationRequests, 1);
    assert.equal(igdbGameRequests, 1);
    assert.equal(igdbTimeRequests, 1);

    const storedMetadata = database
      .prepare(
        `
        SELECT title
        FROM external_game_metadata
        WHERE id = 'metadata-astro'
      `,
      )
      .get() as unknown as { title: string } | undefined;

    assert.equal(storedMetadata?.title, "Current Astro Metadata");
  } finally {
    await closeServer(server);
    database.close();

    await rm(cacheDirectory, {
      recursive: true,
      force: true,
    });
  }
});
