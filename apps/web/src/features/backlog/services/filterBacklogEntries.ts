import type { GameEntry } from "../../../domain/backlog";
import type { BacklogFilters } from "../types/backlogFilters";

export function filterBacklogEntries(gameEntries: GameEntry[], filters: BacklogFilters): GameEntry[] {
  const normalizedSearchText = filters.searchText.trim().toLowerCase();

  return gameEntries.filter((gameEntry) => {
    const matchesSearchText = normalizedSearchText.length === 0 || gameEntry.title.toLowerCase().includes(normalizedSearchText);

    const matchesStatusFilter = doesGameMatchStatusFilter(gameEntry, filters.statusFilter);

    const matchesBucketFilter = filters.bucketId === null || gameEntry.bucketIds.includes(filters.bucketId);

    return matchesSearchText && matchesStatusFilter && matchesBucketFilter;
  });
}

function doesGameMatchStatusFilter(gameEntry: GameEntry, statusFilter: BacklogFilters["statusFilter"]): boolean {
  switch (statusFilter) {
    case "all":
      return true;

    case "not_completed":
      return !isGameHundredPercentComplete(gameEntry);

    case "in_progress":
      return isGameInProgress(gameEntry);

    case "completed":
      return isGameCompleted(gameEntry);

    case "hundred_percent_not_platinumed":
      return isGameHundredPercentComplete(gameEntry) && !gameEntry.trophyProgress.platinumEarned && gameEntry.trophyStatus !== "platinumed";

    case "hundred_percent":
      return isGameHundredPercentComplete(gameEntry);
  }
}

function isGameCompleted(gameEntry: GameEntry): boolean {
  return (
    gameEntry.playStatus === "completed" ||
    gameEntry.trophyStatus === "platinumed" ||
    gameEntry.trophyStatus === "hundred_percent" ||
    isGameHundredPercentComplete(gameEntry)
  );
}

function isGameHundredPercentComplete(gameEntry: GameEntry): boolean {
  return (
    gameEntry.trophyProgress.completionPercent === 100 || gameEntry.trophyStatus === "platinumed" || gameEntry.trophyStatus === "hundred_percent"
  );
}

function isGameInProgress(gameEntry: GameEntry): boolean {
  const completionPercent = gameEntry.trophyProgress.completionPercent ?? 0;

  return (
    gameEntry.playStatus === "playing" ||
    gameEntry.trophyStatus === "started" ||
    gameEntry.trophyStatus === "cleanup" ||
    (completionPercent > 0 && completionPercent < 100)
  );
}
