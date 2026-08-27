import type { DatabaseSync } from "node:sqlite";
import type {
  TrophyAlertAddedTrophy,
  TrophyAlertTrophySetChange,
} from "../alerts/trophyAlertTypes.js";
import type {
  PlayStationTrophyCounts,
  PlayStationTrophyType,
} from "./playStationTypes.js";

interface TrophyChangeRow {
  trophy_id: number;
  trophy_group_id: string;
  trophy_group_name: string;
  trophy_type: PlayStationTrophyType;
  name: string | null;
  detail: string | null;
  icon_url: string | null;
  icon_image_id: string | null;
}

function countTrophies(counts: PlayStationTrophyCounts): number {
  return counts.bronze + counts.silver + counts.gold + counts.platinum;
}

function positiveDifference(
  previous: PlayStationTrophyCounts,
  current: PlayStationTrophyCounts,
): PlayStationTrophyCounts {
  return {
    bronze: Math.max(0, current.bronze - previous.bronze),
    silver: Math.max(0, current.silver - previous.silver),
    gold: Math.max(0, current.gold - previous.gold),
    platinum: Math.max(0, current.platinum - previous.platinum),
  };
}

function countByType(
  trophies: readonly TrophyAlertAddedTrophy[],
): PlayStationTrophyCounts {
  const counts: PlayStationTrophyCounts = {
    bronze: 0,
    silver: 0,
    gold: 0,
    platinum: 0,
  };

  for (const trophy of trophies) {
    counts[trophy.trophyType] += 1;
  }

  return counts;
}

function countsEqual(
  first: PlayStationTrophyCounts,
  second: PlayStationTrophyCounts,
): boolean {
  return (
    first.bronze === second.bronze &&
    first.silver === second.silver &&
    first.gold === second.gold &&
    first.platinum === second.platinum
  );
}

export function identifyAddedTrophies(
  previous: PlayStationTrophyCounts,
  current: PlayStationTrophyCounts,
  appendedTrophies: readonly TrophyAlertAddedTrophy[],
): TrophyAlertTrophySetChange {
  const previousTotal = countTrophies(previous);
  const currentTotal = countTrophies(current);
  const expectedAdditions = positiveDifference(previous, current);
  const addedCount = currentTotal - previousTotal;
  const changesAreAppendOnly =
    addedCount > 0 && countTrophies(expectedAdditions) === addedCount;
  const exact =
    changesAreAppendOnly &&
    appendedTrophies.length === addedCount &&
    countsEqual(countByType(appendedTrophies), expectedAdditions);

  if (!exact) {
    return {
      detailStatus: "summary_only",
      addedTrophies: [],
      affectedGroups: [],
    };
  }

  const groups = new Map<
    string,
    { trophyGroupId: string; name: string; addedTrophyCount: number }
  >();

  for (const trophy of appendedTrophies) {
    const group = groups.get(trophy.trophyGroupId);

    if (group === undefined) {
      groups.set(trophy.trophyGroupId, {
        trophyGroupId: trophy.trophyGroupId,
        name: trophy.trophyGroupName,
        addedTrophyCount: 1,
      });
    } else {
      group.addedTrophyCount += 1;
    }
  }

  return {
    detailStatus: "exact",
    addedTrophies: appendedTrophies,
    affectedGroups: [...groups.values()],
  };
}

export class PlayStationTrophySetChangeService {
  constructor(private readonly database: DatabaseSync) {}

  describe(
    gameId: string,
    previous: PlayStationTrophyCounts,
    current: PlayStationTrophyCounts,
  ): TrophyAlertTrophySetChange {
    const previousTotal = countTrophies(previous);

    const rows = this.database
      .prepare(
        `
          SELECT
            pt.trophy_id,
            pt.trophy_group_id,
            pg.name AS trophy_group_name,
            pt.trophy_type,
            pt.name,
            pt.detail,
            pt.icon_url,
            pt.icon_image_id
          FROM playstation_trophies pt
          INNER JOIN playstation_trophy_groups pg
            ON pg.game_id = pt.game_id
            AND pg.trophy_group_id = pt.trophy_group_id
          WHERE pt.game_id = ?
          ORDER BY pt.trophy_id
          LIMIT -1 OFFSET ?
        `,
      )
      .all(gameId, previousTotal) as unknown as TrophyChangeRow[];

    return identifyAddedTrophies(
      previous,
      current,
      rows.map((row) => ({
        trophyId: row.trophy_id,
        trophyGroupId: row.trophy_group_id,
        trophyGroupName: row.trophy_group_name,
        trophyType: row.trophy_type,
        name: row.name,
        detail: row.detail,
        iconUrl: row.icon_url,
        iconImageId: row.icon_image_id,
      })),
    );
  }
}
