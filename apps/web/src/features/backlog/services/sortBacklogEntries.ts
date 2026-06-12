import type { GameEntry } from "../../../domain/backlog";
import type { BacklogSortMode } from "../types/backlogFilters";

export function sortBacklogEntries(gameEntries: GameEntry[], sortMode: BacklogSortMode): GameEntry[] {
  const copiedGameEntries = [...gameEntries];

  switch (sortMode) {
    case "priority":
      return copiedGameEntries.sort(compareByPriority);

    case "title_az":
      return copiedGameEntries.sort(compareByTitle);

    case "rating_high_to_low":
      return copiedGameEntries.sort(compareByRatingHighToLow);

    case "rating_low_to_high":
      return copiedGameEntries.sort(compareByRatingLowToHigh);
  }
}

function compareByPriority(firstGame: GameEntry, secondGame: GameEntry): number {
  return firstGame.priorityOrder - secondGame.priorityOrder;
}

function compareByTitle(firstGame: GameEntry, secondGame: GameEntry): number {
  const firstTitle = firstGame.sortTitle ?? firstGame.title;
  const secondTitle = secondGame.sortTitle ?? secondGame.title;

  return firstTitle.localeCompare(secondTitle);
}

function compareByRatingHighToLow(firstGame: GameEntry, secondGame: GameEntry): number {
  const firstRating = firstGame.rating ?? Number.NEGATIVE_INFINITY;
  const secondRating = secondGame.rating ?? Number.NEGATIVE_INFINITY;

  if (firstRating !== secondRating) {
    return secondRating - firstRating;
  }

  return compareByPriority(firstGame, secondGame);
}

function compareByRatingLowToHigh(firstGame: GameEntry, secondGame: GameEntry): number {
  const firstRating = firstGame.rating ?? Number.POSITIVE_INFINITY;
  const secondRating = secondGame.rating ?? Number.POSITIVE_INFINITY;

  if (firstRating !== secondRating) {
    return firstRating - secondRating;
  }

  return compareByPriority(firstGame, secondGame);
}
