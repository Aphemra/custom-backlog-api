import type { TrophyHistoryRepository } from "./trophyHistoryRepository.js";
import type {
  TrophyHistoryLogQuery,
  TrophyHistoryLogResult,
  TrophyHistoryMilestoneQuery,
  TrophyHistoryMilestoneResult,
  TrophyHistoryOverview,
  TrophyHistoryResult,
  TrophyHistoryStatistics,
  TrophyProgressionEntry,
} from "./historyTypes.js";

type TrophyHistorySource = Pick<TrophyHistoryRepository, "find">;

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Mark}+/gu, "")
    .replace(/['’]/gu, "")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("en-US");
}

function matchesSearch(
  entry: TrophyProgressionEntry,
  search: string | null,
): boolean {
  if (search === null) {
    return true;
  }

  const tokens = normalizeSearchText(search)
    .split(" ")
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    return true;
  }

  const searchableText = normalizeSearchText(
    [
      entry.gameTitle,
      entry.trophyName ?? "",
      entry.trophyDetail ?? "",
      entry.platform,
    ].join(" "),
  );

  return tokens.every((token) => searchableText.includes(token));
}

function reverseIfDescending<T>(
  values: readonly T[],
  direction: "asc" | "desc",
): readonly T[] {
  if (direction === "asc") {
    return values;
  }

  return [...values].reverse();
}

export class TrophyHistoryQueryService {
  constructor(private readonly source: TrophyHistorySource) {}

  getOverview(): TrophyHistoryOverview {
    const history = this.source.find();

    return {
      summary: history.timeline.summary,
      coverage: history.coverage,
      latestEarnedTrophy: history.timeline.entries.at(-1) ?? null,
      latestMilestone: history.timeline.milestones.at(-1) ?? null,
    };
  }

  getStatistics(): TrophyHistoryStatistics {
    const history = this.source.find();
    const platformOrder = ["PS3", "PS4", "PS5"] as const;
    const trophyTypeOrder = ["bronze", "silver", "gold", "platinum"] as const;

    const platformTotals = new Map(
      platformOrder.map((platform) => [
        platform,
        {
          trophyCount: 0,
          points: 0,
        },
      ]),
    );

    const trophyTypeTotals = new Map(
      trophyTypeOrder.map((trophyType) => [
        trophyType,
        {
          trophyCount: 0,
          points: 0,
        },
      ]),
    );

    const monthlyTotals = new Map<
      string,
      {
        trophyCount: number;
        points: number;
      }
    >();

    const representedGames = new Set<string>();

    for (const entry of history.timeline.entries) {
      representedGames.add(entry.gameId);

      const platformTotal = platformTotals.get(entry.platform);

      if (platformTotal !== undefined) {
        platformTotal.trophyCount += 1;
        platformTotal.points += entry.pointsAwarded;
      }

      const trophyTypeTotal = trophyTypeTotals.get(entry.trophyType);

      if (trophyTypeTotal !== undefined) {
        trophyTypeTotal.trophyCount += 1;
        trophyTypeTotal.points += entry.pointsAwarded;
      }

      const month = entry.earnedAt.slice(0, 7);
      const monthlyTotal = monthlyTotals.get(month) ?? {
        trophyCount: 0,
        points: 0,
      };

      monthlyTotal.trophyCount += 1;
      monthlyTotal.points += entry.pointsAwarded;
      monthlyTotals.set(month, monthlyTotal);
    }

    const monthlyActivity = [...monthlyTotals.entries()]
      .toSorted(([leftMonth], [rightMonth]) =>
        leftMonth.localeCompare(rightMonth),
      )
      .map(([month, totals]) => ({
        month,
        trophyCount: totals.trophyCount,
        points: totals.points,
      }));

    return {
      gamesRepresented: representedGames.size,
      activeMonths: monthlyActivity.length,
      byPlatform: platformOrder.map((platform) => {
        const totals = platformTotals.get(platform)!;

        return {
          platform,
          trophyCount: totals.trophyCount,
          points: totals.points,
        };
      }),
      byTrophyType: trophyTypeOrder.map((trophyType) => {
        const totals = trophyTypeTotals.get(trophyType)!;

        return {
          trophyType,
          trophyCount: totals.trophyCount,
          points: totals.points,
        };
      }),
      monthlyActivity,
    };
  }

  listTrophies(query: TrophyHistoryLogQuery): TrophyHistoryLogResult {
    const history = this.source.find();
    const earnedFromMilliseconds =
      query.earnedFrom === null ? null : Date.parse(query.earnedFrom);
    const earnedToMilliseconds =
      query.earnedTo === null ? null : Date.parse(query.earnedTo);

    const filtered = history.timeline.entries.filter((entry) => {
      if (query.platform !== null && entry.platform !== query.platform) {
        return false;
      }

      if (query.trophyType !== null && entry.trophyType !== query.trophyType) {
        return false;
      }

      if (query.gameId !== null && entry.gameId !== query.gameId) {
        return false;
      }

      const earnedAtMilliseconds = Date.parse(entry.earnedAt);

      if (
        earnedFromMilliseconds !== null &&
        earnedAtMilliseconds < earnedFromMilliseconds
      ) {
        return false;
      }

      if (
        earnedToMilliseconds !== null &&
        earnedAtMilliseconds > earnedToMilliseconds
      ) {
        return false;
      }

      return matchesSearch(entry, query.search);
    });

    const ordered = reverseIfDescending(filtered, query.direction);
    const totalItems = ordered.length;
    const totalPages =
      totalItems === 0 ? 0 : Math.ceil(totalItems / query.pageSize);
    const offset = (query.page - 1) * query.pageSize;

    return {
      trophies: ordered.slice(offset, offset + query.pageSize),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages,
      },
    };
  }

  listMilestones(
    query: TrophyHistoryMilestoneQuery,
  ): TrophyHistoryMilestoneResult {
    const history = this.source.find();

    const filtered =
      query.kind === null
        ? history.timeline.milestones
        : history.timeline.milestones.filter(
            (milestone) => milestone.kind === query.kind,
          );

    return {
      milestones: reverseIfDescending(filtered, query.direction),
    };
  }
}

export function createTrophyHistoryQueryService(
  history: TrophyHistoryResult,
): TrophyHistoryQueryService {
  return new TrophyHistoryQueryService({
    find() {
      return history;
    },
  });
}
