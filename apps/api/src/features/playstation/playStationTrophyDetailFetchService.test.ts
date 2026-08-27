import assert from "node:assert/strict";
import { test } from "node:test";
import { HttpError } from "../../errors/httpError.js";
import type {
  PlayStationTrophyDetailApiOperations,
  PlayStationAuthorization,
} from "./playStationApi.js";
import {
  PlayStationTrophyDetailFetchService,
  type PlayStationAuthorizationProvider,
} from "./playStationTrophyDetailFetchService.js";
import { PlayStationRequestGate } from "./playStationRequestGate.js";
import type {
  PlayStationTrophyTitlePreview,
  PlayStationTrophyType,
} from "./playStationTypes.js";

const definitions = [
  {
    trophyId: 0,
    trophyHidden: false,
    trophyType: "bronze",
    trophyName: "First Trophy",
    trophyDetail: "Earn the first trophy.",
    trophyIconUrl: "https://example.com/trophy-0.png",
    trophyGroupId: "default",
  },
  {
    trophyId: 1,
    trophyHidden: false,
    trophyType: "silver",
    trophyName: "Silver Trophy",
    trophyIconUrl: "https://example.com/trophy-1.png",
    trophyGroupId: "default",
  },
  {
    trophyId: 2,
    trophyHidden: false,
    trophyType: "platinum",
    trophyName: "Platinum Trophy",
    trophyIconUrl: "https://example.com/trophy-2.png",
    trophyGroupId: "default",
  },
  {
    trophyId: 3,
    trophyHidden: true,
    trophyType: "bronze",
    trophyGroupId: "001",
  },
] as const;

const earnings = definitions.map((definition, index) => ({
  trophyId: definition.trophyId,
  trophyHidden: definition.trophyHidden,
  earned: index < 2,
  ...(index < 2
    ? {
        earnedDateTime: `2026-08-2${index + 6}T12:00:00Z`,
      }
    : {}),
  trophyType: definition.trophyType,
  trophyRare: index % 4,
  trophyEarnedRate: String(10 + index),
}));

function createTitle(
  overrides: Partial<PlayStationTrophyTitlePreview> = {},
): PlayStationTrophyTitlePreview {
  return {
    npServiceName: "trophy2",
    npCommunicationId: "NPWR99999_00",
    trophySetVersion: "01.00",
    name: "Example Trophy Game",
    detail: null,
    iconUrl: "https://example.com/title.png",
    platforms: ["PS5"],
    hasTrophyGroups: true,
    definedTrophies: {
      bronze: 2,
      silver: 1,
      gold: 0,
      platinum: 1,
    },
    progress: 50,
    earnedTrophies: {
      bronze: 1,
      silver: 1,
      gold: 0,
      platinum: 0,
    },
    hidden: false,
    lastUpdatedAt: "2026-08-27T12:00:00Z",
    ...overrides,
  };
}

function createGroupsPayload(
  trophySetVersion = "01.00",
): Record<string, unknown> {
  return {
    trophySetVersion,
    trophyTitleName: "Example Trophy Game",
    trophyTitleIconUrl: "https://example.com/title.png",
    trophyTitlePlatform: "PS5",
    definedTrophies: {
      bronze: 2,
      silver: 1,
      gold: 0,
      platinum: 1,
    },
    trophyGroups: [
      {
        trophyGroupId: "default",
        trophyGroupName: "Example Trophy Game",
        trophyGroupIconUrl: "https://example.com/default.png",
        definedTrophies: {
          bronze: 1,
          silver: 1,
          gold: 0,
          platinum: 1,
        },
      },
      {
        trophyGroupId: "001",
        trophyGroupName: "Additional Trophies",
        trophyGroupIconUrl: "https://example.com/001.png",
        definedTrophies: {
          bronze: 1,
          silver: 0,
          gold: 0,
          platinum: 0,
        },
      },
    ],
  };
}

function createDefinitionsPage(
  offset: number,
  trophySetVersion = "01.00",
): Record<string, unknown> {
  const pageDefinitions =
    offset === 0 ? definitions.slice(0, 3) : definitions.slice(3);

  return {
    trophySetVersion,
    hasTrophyGroups: true,
    trophies: pageDefinitions,
    totalItemCount: definitions.length,
    ...(offset === 0 ? { nextOffset: 3 } : {}),
  };
}

function createEarningsPage(
  offset: number,
  trophySetVersion = "01.00",
): Record<string, unknown> {
  const pageEarnings = offset === 0 ? earnings.slice(0, 3) : earnings.slice(3);

  return {
    trophySetVersion,
    hasTrophyGroups: true,
    lastUpdatedDateTime: "2026-08-27T12:00:00Z",
    trophies: pageEarnings,
    totalItemCount: earnings.length,
    ...(offset === 0 ? { nextOffset: 3 } : {}),
  };
}

function createAuthorizationProvider(): PlayStationAuthorizationProvider {
  return {
    async getAuthorization(): Promise<PlayStationAuthorization> {
      return {
        accessToken: "test-access-token",
      };
    },
  };
}

function createRequestGate(): PlayStationRequestGate {
  return new PlayStationRequestGate({
    minimumIntervalMs: 0,
  });
}

test("fetches and validates paginated trophy details safely", async () => {
  const calls: string[] = [];

  const operations: PlayStationTrophyDetailApiOperations = {
    async getTrophyGroups(_authorization, npCommunicationId, options) {
      assert.equal(npCommunicationId, "NPWR99999_00");
      assert.equal(options.npServiceName, "trophy2");
      calls.push("groups");
      return createGroupsPayload();
    },

    async getTrophyDefinitions(
      _authorization,
      npCommunicationId,
      trophyGroupId,
      options,
    ) {
      assert.equal(npCommunicationId, "NPWR99999_00");
      assert.equal(trophyGroupId, "all");
      assert.equal(options.npServiceName, "trophy2");
      assert.equal(options.limit, 500);
      calls.push(`definitions:${options.offset}`);
      return createDefinitionsPage(options.offset);
    },

    async getTrophyEarnings(
      _authorization,
      accountId,
      npCommunicationId,
      trophyGroupId,
      options,
    ) {
      assert.equal(accountId, "target-account-id");
      assert.equal(npCommunicationId, "NPWR99999_00");
      assert.equal(trophyGroupId, "all");
      assert.equal(options.npServiceName, "trophy2");
      assert.equal(options.limit, 500);
      calls.push(`earnings:${options.offset}`);
      return createEarningsPage(options.offset);
    },
  };

  const service = new PlayStationTrophyDetailFetchService(
    createAuthorizationProvider(),
    operations,
    createRequestGate(),
  );

  const result = await service.fetchTitle("target-account-id", createTitle());

  assert.deepEqual(calls, [
    "groups",
    "definitions:0",
    "definitions:3",
    "earnings:0",
    "earnings:3",
  ]);

  assert.equal(result.definitions.length, 4);
  assert.equal(result.earnings.length, 4);
  assert.equal(result.trophySet.groups.length, 2);
  assert.equal(result.lastUpdatedAt, "2026-08-27T12:00:00Z");
  assert.equal(result.requestsMade, 5);
  assert.equal(result.retriesUsed, 0);

  assert.deepEqual(
    result.definitions.map((definition) => ({
      id: definition.trophyId,
      type: definition.trophyType,
      group: definition.trophyGroupId,
    })),
    [
      {
        id: 0,
        type: "bronze",
        group: "default",
      },
      {
        id: 1,
        type: "silver",
        group: "default",
      },
      {
        id: 2,
        type: "platinum",
        group: "default",
      },
      {
        id: 3,
        type: "bronze",
        group: "001",
      },
    ],
  );
});

test("rejects a trophy set that changes during the fetch", async () => {
  let requestsMade = 0;

  const operations: PlayStationTrophyDetailApiOperations = {
    async getTrophyGroups() {
      requestsMade += 1;
      return createGroupsPayload();
    },

    async getTrophyDefinitions(
      _authorization,
      _npCommunicationId,
      _trophyGroupId,
      options,
    ) {
      requestsMade += 1;
      return createDefinitionsPage(options.offset, "02.00");
    },

    async getTrophyEarnings() {
      throw new Error("Earnings should not be requested.");
    },
  };

  const service = new PlayStationTrophyDetailFetchService(
    createAuthorizationProvider(),
    operations,
    createRequestGate(),
  );

  await assert.rejects(
    service.fetchTitle("target-account-id", createTitle()),
    (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.code, "playstation_trophy_set_changed");
      return true;
    },
  );

  assert.equal(requestsMade, 2);
});

test("retries one temporary transport failure without bypassing the gate", async () => {
  let groupAttempts = 0;

  const operations: PlayStationTrophyDetailApiOperations = {
    async getTrophyGroups() {
      groupAttempts += 1;

      if (groupAttempts === 1) {
        throw new Error("fetch failed: temporary network failure");
      }

      return createGroupsPayload();
    },

    async getTrophyDefinitions(
      _authorization,
      _npCommunicationId,
      _trophyGroupId,
      options,
    ) {
      return createDefinitionsPage(options.offset);
    },

    async getTrophyEarnings(
      _authorization,
      _accountId,
      _npCommunicationId,
      _trophyGroupId,
      options,
    ) {
      return createEarningsPage(options.offset);
    },
  };

  const service = new PlayStationTrophyDetailFetchService(
    createAuthorizationProvider(),
    operations,
    createRequestGate(),
  );

  const result = await service.fetchTitle("target-account-id", createTitle());

  assert.equal(groupAttempts, 2);
  assert.equal(result.requestsMade, 6);
  assert.equal(result.retriesUsed, 1);
});

test("refreshes earnings without requesting definitions or groups", async () => {
  const calls: string[] = [];

  const operations: PlayStationTrophyDetailApiOperations = {
    async getTrophyGroups() {
      throw new Error("Trophy groups should not be requested.");
    },

    async getTrophyDefinitions() {
      throw new Error("Trophy definitions should not be requested.");
    },

    async getTrophyEarnings(
      _authorization,
      accountId,
      npCommunicationId,
      trophyGroupId,
      options,
    ) {
      assert.equal(accountId, "target-account-id");
      assert.equal(npCommunicationId, "NPWR99999_00");
      assert.equal(trophyGroupId, "all");
      assert.equal(options.limit, 500);
      calls.push(`earnings:${options.offset}`);
      return createEarningsPage(options.offset);
    },
  };

  const service = new PlayStationTrophyDetailFetchService(
    createAuthorizationProvider(),
    operations,
    createRequestGate(),
  );

  const result = await service.fetchEarningsOnly(
    "target-account-id",
    createTitle(),
  );

  assert.deepEqual(calls, ["earnings:0", "earnings:3"]);
  assert.equal(result.earnings.length, 4);
  assert.equal(result.requestsMade, 2);
  assert.equal(result.retriesUsed, 0);
});

test("does not retry PlayStation throttling", async () => {
  let groupAttempts = 0;

  const operations: PlayStationTrophyDetailApiOperations = {
    async getTrophyGroups() {
      groupAttempts += 1;
      throw new Error("429 Too Many Requests");
    },

    async getTrophyDefinitions() {
      throw new Error("Definitions should not be requested.");
    },

    async getTrophyEarnings() {
      throw new Error("Earnings should not be requested.");
    },
  };

  const service = new PlayStationTrophyDetailFetchService(
    createAuthorizationProvider(),
    operations,
    createRequestGate(),
  );

  await assert.rejects(
    service.fetchTitle("target-account-id", createTitle()),
    (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.code, "playstation_throttled");
      return true;
    },
  );

  assert.equal(groupAttempts, 1);
});

test("rejects mismatched trophy types across definition and earnings feeds", async () => {
  const mismatchedEarnings = earnings.map((earning, index) => ({
    ...earning,
    trophyType:
      index === 0 ? ("gold" as PlayStationTrophyType) : earning.trophyType,
  }));

  const operations: PlayStationTrophyDetailApiOperations = {
    async getTrophyGroups() {
      return createGroupsPayload();
    },

    async getTrophyDefinitions(
      _authorization,
      _npCommunicationId,
      _trophyGroupId,
      options,
    ) {
      return createDefinitionsPage(options.offset);
    },

    async getTrophyEarnings(
      _authorization,
      _accountId,
      _npCommunicationId,
      _trophyGroupId,
      options,
    ) {
      const pageEarnings =
        options.offset === 0
          ? mismatchedEarnings.slice(0, 3)
          : mismatchedEarnings.slice(3);

      return {
        trophySetVersion: "01.00",
        hasTrophyGroups: true,
        lastUpdatedDateTime: "2026-08-27T12:00:00Z",
        trophies: pageEarnings,
        totalItemCount: mismatchedEarnings.length,
        ...(options.offset === 0 ? { nextOffset: 3 } : {}),
      };
    },
  };

  const service = new PlayStationTrophyDetailFetchService(
    createAuthorizationProvider(),
    operations,
    createRequestGate(),
  );

  await assert.rejects(
    service.fetchTitle("target-account-id", createTitle()),
    (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.code, "invalid_playstation_trophy_detail_response");
      return true;
    },
  );
});
