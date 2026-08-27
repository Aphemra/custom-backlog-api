import assert from "node:assert/strict";
import { test } from "node:test";
import { HttpError } from "../../errors/httpError.js";
import {
  parsePlayStationTrophyDefinitionsPage,
  parsePlayStationTrophyEarningsPage,
  parsePlayStationTrophyGroups,
} from "./playStationTrophyDetailParser.js";

function assertInvalidResponse(action: () => unknown): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof HttpError);
    assert.equal(error.code, "invalid_playstation_trophy_detail_response");
    assert.equal(error.statusCode, 502);
    return true;
  });
}

test("parses trophy-set and group definitions", () => {
  const payload = {
    trophySetVersion: "01.00",
    trophyTitleName: "Example Trophy Game",
    trophyTitleDetail: "An example trophy set.",
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
        trophyGroupDetail: "Base-game trophies.",
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

  const result = parsePlayStationTrophyGroups(payload);

  assert.equal(result.trophySetVersion, "01.00");
  assert.equal(result.titleName, "Example Trophy Game");
  assert.deepEqual(result.platforms, ["PS5"]);
  assert.equal(result.hasTrophyGroups, true);
  assert.equal(result.groups.length, 2);
  assert.equal(result.groups[0]?.trophyGroupId, "default");
  assert.equal(result.groups[1]?.trophyGroupId, "001");
  assert.equal(result.groups[1]?.detail, null);
  assert.equal(result.providerPayload, payload);
});

test("parses trophy definitions with optional hidden metadata", () => {
  const payload = {
    trophySetVersion: "01.00",
    hasTrophyGroups: true,
    trophies: [
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
        trophyHidden: true,
        trophyType: "silver",
        trophyGroupId: "001",
      },
    ],
    totalItemCount: 4,
    nextOffset: 2,
  };

  const result = parsePlayStationTrophyDefinitionsPage(payload);

  assert.equal(result.totalItemCount, 4);
  assert.equal(result.nextOffset, 2);
  assert.equal(result.trophies.length, 2);

  assert.deepEqual(result.trophies[0], {
    trophyId: 0,
    trophyGroupId: "default",
    trophyType: "bronze",
    hidden: false,
    name: "First Trophy",
    detail: "Earn the first trophy.",
    iconUrl: "https://example.com/trophy-0.png",
    providerPayload: payload.trophies[0],
  });

  assert.deepEqual(result.trophies[1], {
    trophyId: 1,
    trophyGroupId: "001",
    trophyType: "silver",
    hidden: true,
    name: null,
    detail: null,
    iconUrl: null,
    providerPayload: payload.trophies[1],
  });
});

test("parses trophy earnings, rarity, and PS5 progress", () => {
  const payload = {
    trophySetVersion: "01.00",
    hasTrophyGroups: false,
    lastUpdatedDateTime: "2026-08-27T12:00:00Z",
    trophies: [
      {
        trophyId: 0,
        trophyHidden: false,
        earned: true,
        earnedDateTime: "2026-08-27T12:00:00Z",
        trophyType: "bronze",
        trophyRare: 0,
        trophyEarnedRate: "2.50",
        trophyProgressTargetValue: "100",
        progress: 100,
        progressRate: "100",
        trophyRewardName: "Example Reward",
        trophyRewardImageUrl: "https://example.com/reward.png",
      },
      {
        trophyId: 1,
        trophyHidden: true,
        earned: true,
        trophyType: "silver",
        trophyRare: 1,
        trophyEarnedRate: "8.75",
      },
    ],
    totalItemCount: 2,
  };

  const result = parsePlayStationTrophyEarningsPage(payload);

  assert.equal(result.nextOffset, null);
  assert.equal(result.lastUpdatedAt, "2026-08-27T12:00:00Z");

  assert.deepEqual(result.trophies[0], {
    trophyId: 0,
    trophyType: "bronze",
    hidden: false,
    earned: true,
    earnedAt: "2026-08-27T12:00:00Z",
    rarity: 0,
    earnedRate: 2.5,
    progressTargetValue: "100",
    progressValue: "100",
    progressRate: 100,
    rewardName: "Example Reward",
    rewardImageUrl: "https://example.com/reward.png",
    providerPayload: payload.trophies[0],
  });

  assert.equal(result.trophies[1]?.earned, true);
  assert.equal(result.trophies[1]?.earnedAt, null);
});

test("rejects malformed detailed trophy responses", () => {
  assertInvalidResponse(() =>
    parsePlayStationTrophyGroups({
      trophySetVersion: "01.00",
      trophyTitleName: "Bad Icon Game",
      trophyTitleIconUrl: "http://example.com/title.png",
      trophyTitlePlatform: "PS5",
      definedTrophies: {
        bronze: 1,
        silver: 0,
        gold: 0,
        platinum: 0,
      },
      trophyGroups: [
        {
          trophyGroupId: "default",
          trophyGroupName: "Bad Icon Game",
          trophyGroupIconUrl: "https://example.com/group.png",
          definedTrophies: {
            bronze: 1,
            silver: 0,
            gold: 0,
            platinum: 0,
          },
        },
      ],
    }),
  );

  assertInvalidResponse(() =>
    parsePlayStationTrophyDefinitionsPage({
      trophySetVersion: "01.00",
      hasTrophyGroups: false,
      trophies: [
        {
          trophyId: 0,
          trophyHidden: false,
          trophyType: "bronze",
          trophyGroupId: "default",
        },
        {
          trophyId: 0,
          trophyHidden: false,
          trophyType: "silver",
          trophyGroupId: "default",
        },
      ],
      totalItemCount: 2,
    }),
  );

  assertInvalidResponse(() =>
    parsePlayStationTrophyEarningsPage({
      trophySetVersion: "01.00",
      hasTrophyGroups: false,
      lastUpdatedDateTime: "2026-08-27T12:00:00Z",
      trophies: [
        {
          trophyId: 0,
          trophyHidden: false,
          earned: false,
          earnedDateTime: "2026-08-27T12:00:00Z",
          trophyType: "bronze",
        },
      ],
      totalItemCount: 1,
    }),
  );

  assertInvalidResponse(() =>
    parsePlayStationTrophyEarningsPage({
      trophySetVersion: "01.00",
      hasTrophyGroups: false,
      lastUpdatedDateTime: "2026-08-27T12:00:00Z",
      trophies: [
        {
          trophyId: 0,
          trophyHidden: false,
          earned: true,
          trophyType: "bronze",
          trophyEarnedRate: "120",
        },
      ],
      totalItemCount: 1,
    }),
  );
});
