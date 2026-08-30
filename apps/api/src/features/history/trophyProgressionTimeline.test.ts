import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  EarnedTrophyHistoryRecord,
  TrophyHistoryMilestoneKind,
} from "./historyTypes.js";
import { buildTrophyProgressionTimeline } from "./trophyProgressionTimeline.js";

function trophyRecord(
  trophyId: number,
  trophyType: EarnedTrophyHistoryRecord["trophyType"],
  earnedAt: string,
  gameId = "history-game",
): EarnedTrophyHistoryRecord {
  return {
    gameId,
    gameTitle: "History Game",
    platform: "PS5",
    trophyId,
    trophyGroupId: "default",
    trophyName: `Trophy ${trophyId}`,
    trophyDetail: null,
    trophyType,
    isSecret: false,
    earnedAt,
    trophyIconImageId: null,
    gameArtworkImageId: null,
  };
}

function milestoneValues(
  timeline: ReturnType<typeof buildTrophyProgressionTimeline>,
  kind: TrophyHistoryMilestoneKind,
): readonly number[] {
  return timeline.milestones
    .filter((milestone) => milestone.kind === kind)
    .map((milestone) => milestone.value);
}

test("orders earned trophies deterministically and calculates progression", () => {
  const timeline = buildTrophyProgressionTimeline([
    trophyRecord(3, "gold", "2026-08-29T12:00:03.000Z"),
    trophyRecord(2, "silver", "2026-08-29T12:00:02.000Z"),
    trophyRecord(1, "bronze", "2026-08-29T12:00:01.000Z"),
  ]);

  assert.deepEqual(
    timeline.entries.map((entry) => entry.trophyId),
    [1, 2, 3],
  );

  assert.deepEqual(
    timeline.entries.map((entry) => entry.sequenceNumber),
    [1, 2, 3],
  );

  assert.deepEqual(timeline.summary.earnedTrophies, {
    bronze: 1,
    silver: 1,
    gold: 1,
    platinum: 0,
  });

  assert.equal(timeline.summary.earnedTrophyCount, 3);
  assert.equal(timeline.summary.totalPoints, 135);
  assert.equal(timeline.summary.calculatedLevel, 3);
  assert.equal(timeline.summary.calculatedLevelProgressPercent, 25);
  assert.equal(timeline.summary.oldestEarnedAt, "2026-08-29T12:00:01.000Z");
  assert.equal(timeline.summary.newestEarnedAt, "2026-08-29T12:00:03.000Z");
});

test("reconstructs trophy, platinum, and level milestones", () => {
  const records: EarnedTrophyHistoryRecord[] = [];

  for (let index = 0; index < 100; index += 1) {
    records.push(
      trophyRecord(
        index,
        "bronze",
        new Date(
          Date.parse("2018-01-01T00:00:00.000Z") + index * 1_000,
        ).toISOString(),
      ),
    );
  }

  for (let index = 0; index < 5; index += 1) {
    records.push(
      trophyRecord(
        100 + index,
        "platinum",
        new Date(
          Date.parse("2018-01-02T00:00:00.000Z") + index * 1_000,
        ).toISOString(),
      ),
    );
  }

  const timeline = buildTrophyProgressionTimeline(records);

  assert.deepEqual(milestoneValues(timeline, "trophy_total"), [1, 100]);

  assert.deepEqual(milestoneValues(timeline, "platinum_total"), [1, 5]);

  assert.deepEqual(
    milestoneValues(timeline, "trophy_level"),
    [10, 20, 30, 40, 50],
  );

  assert.deepEqual(timeline.summary.earnedTrophies, {
    bronze: 100,
    silver: 0,
    gold: 0,
    platinum: 5,
  });

  assert.equal(timeline.summary.earnedTrophyCount, 105);
  assert.equal(timeline.summary.totalPoints, 3_000);
  assert.equal(timeline.summary.calculatedLevel, 51);
  assert.equal(timeline.summary.calculatedLevelProgressPercent, 0);
});

test("rejects malformed timestamps and duplicate trophies", () => {
  assert.throws(
    () =>
      buildTrophyProgressionTimeline([trophyRecord(1, "bronze", "not-a-date")]),
    /invalid earnedAt timestamp/,
  );

  assert.throws(
    () =>
      buildTrophyProgressionTimeline([
        trophyRecord(1, "bronze", "2026-08-29T12:00:00.000Z"),
        trophyRecord(1, "bronze", "2026-08-29T12:00:01.000Z"),
      ]),
    /duplicate trophy history-game:1/,
  );
});
