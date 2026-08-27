import assert from "node:assert/strict";
import { test } from "node:test";
import type { TrophyAlertAddedTrophy } from "../alerts/trophyAlertTypes.js";
import { identifyAddedTrophies } from "./playStationTrophySetChangeService.js";

function addedTrophy(
  trophyId: number,
  trophyType: TrophyAlertAddedTrophy["trophyType"],
  trophyGroupId: string,
  trophyGroupName: string,
): TrophyAlertAddedTrophy {
  return {
    trophyId,
    trophyGroupId,
    trophyGroupName,
    trophyType,
    name: `Trophy ${trophyId}`,
    detail: `Earn trophy ${trophyId}.`,
    iconUrl: `https://image.api.playstation.com/${trophyId}.png`,
    iconImageId: null,
  };
}

test("identifies exact appended trophies and their affected groups", () => {
  assert.deepEqual(
    identifyAddedTrophies(
      {
        bronze: 40,
        silver: 10,
        gold: 3,
        platinum: 1,
      },
      {
        bronze: 42,
        silver: 11,
        gold: 3,
        platinum: 1,
      },
      [
        addedTrophy(54, "bronze", "001", "Challenge Pack"),
        addedTrophy(55, "bronze", "001", "Challenge Pack"),
        addedTrophy(56, "silver", "002", "Final Trials"),
      ],
    ),
    {
      detailStatus: "exact",
      addedTrophies: [
        addedTrophy(54, "bronze", "001", "Challenge Pack"),
        addedTrophy(55, "bronze", "001", "Challenge Pack"),
        addedTrophy(56, "silver", "002", "Final Trials"),
      ],
      affectedGroups: [
        {
          trophyGroupId: "001",
          name: "Challenge Pack",
          addedTrophyCount: 2,
        },
        {
          trophyGroupId: "002",
          name: "Final Trials",
          addedTrophyCount: 1,
        },
      ],
    },
  );
});

test("refuses to guess when the trophy changes are not append-only", () => {
  assert.deepEqual(
    identifyAddedTrophies(
      {
        bronze: 2,
        silver: 1,
        gold: 0,
        platinum: 0,
      },
      {
        bronze: 1,
        silver: 2,
        gold: 0,
        platinum: 0,
      },
      [],
    ),
    {
      detailStatus: "summary_only",
      addedTrophies: [],
      affectedGroups: [],
    },
  );
});
