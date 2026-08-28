import type { LibraryGameListItem } from "../../domain/libraryGame";
import type {
  SavedView,
  SavedViewFilters,
  SavedViewSortField,
  SortDirection,
} from "../../domain/savedView";

type SortValue = number | string | null;

interface NormalizedSearchText {
  readonly spaced: string;
  readonly compact: string;
}

function normalizeSearchText(value: string): NormalizedSearchText {
  const spaced = value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    spaced,
    compact: spaced.replace(/\s+/g, ""),
  };
}

function includesNormalizedSearch(
  value: string,
  search: NormalizedSearchText,
): boolean {
  const normalizedValue = normalizeSearchText(value);

  return (
    normalizedValue.spaced.includes(search.spaced) ||
    normalizedValue.compact.includes(search.compact)
  );
}

function matchesSearch(
  game: LibraryGameListItem,
  search: string | undefined,
): boolean {
  if (search === undefined || search.trim().length === 0) {
    return true;
  }

  const normalizedSearch = normalizeSearchText(search);

  if (normalizedSearch.spaced.length === 0) {
    return true;
  }

  return (
    includesNormalizedSearch(game.title, normalizedSearch) ||
    includesNormalizedSearch(game.notes ?? "", normalizedSearch)
  );
}

function matchesAlerts(
  game: LibraryGameListItem,
  filters: SavedViewFilters,
): boolean {
  if (filters.alertKinds === undefined && filters.alertStatus === undefined) {
    return true;
  }

  return game.viewData.alerts.some(
    (alert) =>
      (filters.alertKinds === undefined ||
        filters.alertKinds.includes(alert.kind)) &&
      (filters.alertStatus === undefined ||
        filters.alertStatus === alert.status),
  );
}

function matchesFilters(
  game: LibraryGameListItem,
  filters: SavedViewFilters,
  liveSearch: string,
): boolean {
  const hiddenMode = filters.hiddenMode ?? "visible";

  if (hiddenMode === "visible" && game.hiddenAt !== null) {
    return false;
  }

  if (hiddenMode === "hidden" && game.hiddenAt === null) {
    return false;
  }

  if (
    filters.platforms !== undefined &&
    !filters.platforms.includes(game.platform)
  ) {
    return false;
  }

  if (
    filters.playStatuses !== undefined &&
    !filters.playStatuses.includes(game.playStatus)
  ) {
    return false;
  }

  if (
    filters.collectionIds !== undefined &&
    !filters.collectionIds.some((collectionId) =>
      game.viewData.collectionIds.includes(collectionId),
    )
  ) {
    return false;
  }

  if (filters.platinumEarned !== undefined) {
    if (
      game.trophySummary === null ||
      game.trophySummary.platinumEarned !== filters.platinumEarned
    ) {
      return false;
    }
  }

  if (filters.is100Percent !== undefined) {
    if (
      game.trophySummary === null ||
      game.trophySummary.is100Percent !== filters.is100Percent
    ) {
      return false;
    }
  }

  if (filters.needsSync !== undefined) {
    const needsSync =
      game.viewData.hasPlayStationLink && game.trophySummary === null;

    if (needsSync !== filters.needsSync) {
      return false;
    }
  }

  return (
    matchesAlerts(game, filters) &&
    matchesSearch(game, filters.search) &&
    matchesSearch(game, liveSearch)
  );
}

function latestAlertCreatedAt(game: LibraryGameListItem): string | null {
  let latest: string | null = null;

  for (const alert of game.viewData.alerts) {
    if (latest === null || alert.createdAt > latest) {
      latest = alert.createdAt;
    }
  }

  return latest;
}

function readSortValue(
  game: LibraryGameListItem,
  field: SavedViewSortField,
): SortValue {
  switch (field) {
    case "priorityRank":
      return game.priorityRank;

    case "title":
      return game.sortTitle;

    case "platform":
      return game.platform;

    case "playStatus":
      return game.playStatus;

    case "createdAt":
      return game.createdAt;

    case "updatedAt":
      return game.updatedAt;

    case "progressPercent":
      return game.trophySummary?.progressPercent ?? null;

    case "lastSyncedAt":
      return game.trophySummary?.lastSyncedAt ?? null;

    case "alertCreatedAt":
      return latestAlertCreatedAt(game);
  }
}

function compareValues(
  left: SortValue,
  right: SortValue,
  direction: SortDirection,
): number {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return direction === "asc" ? -1 : 1;
  }

  if (right === null) {
    return direction === "asc" ? 1 : -1;
  }

  const comparison = left < right ? -1 : left > right ? 1 : 0;

  return direction === "desc" ? -comparison : comparison;
}

function compareSortTitles(
  left: LibraryGameListItem,
  right: LibraryGameListItem,
): number {
  return left.sortTitle < right.sortTitle
    ? -1
    : left.sortTitle > right.sortTitle
      ? 1
      : 0;
}

export function applyLibraryView(
  games: readonly LibraryGameListItem[],
  view: SavedView,
  liveSearch: string,
): readonly LibraryGameListItem[] {
  return games
    .filter((game) => matchesFilters(game, view.filters, liveSearch))
    .sort((left, right) => {
      const primaryComparison = compareValues(
        readSortValue(left, view.sort.field),
        readSortValue(right, view.sort.field),
        view.sort.direction,
      );

      return primaryComparison === 0
        ? compareSortTitles(left, right)
        : primaryComparison;
    });
}
