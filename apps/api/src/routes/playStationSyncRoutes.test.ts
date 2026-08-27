import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createApp } from "../app.js";
import { openDatabase } from "../database/database.js";
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
