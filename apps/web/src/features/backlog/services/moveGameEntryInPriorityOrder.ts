import type { GameEntry } from "../../../domain/backlog";

export type PriorityMoveDirection = "up" | "down";

interface MoveGameEntryInPriorityOrderInput {
  gameEntries: GameEntry[];
  gameEntryId: string;
  direction: PriorityMoveDirection;
  updatedAt: string;
}

export function moveGameEntryInPriorityOrder({ gameEntries, gameEntryId, direction, updatedAt }: MoveGameEntryInPriorityOrderInput): GameEntry[] {
  const sortedGameEntries = [...gameEntries].sort((firstGame, secondGame) => firstGame.priorityOrder - secondGame.priorityOrder);

  const currentIndex = sortedGameEntries.findIndex((gameEntry) => gameEntry.id === gameEntryId);

  if (currentIndex === -1) {
    return gameEntries;
  }

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (targetIndex < 0 || targetIndex >= sortedGameEntries.length) {
    return normalizePriorityOrder(sortedGameEntries, updatedAt);
  }

  const reorderedGameEntries = [...sortedGameEntries];

  const currentGameEntry = reorderedGameEntries[currentIndex];
  const targetGameEntry = reorderedGameEntries[targetIndex];

  reorderedGameEntries[currentIndex] = targetGameEntry;
  reorderedGameEntries[targetIndex] = currentGameEntry;

  return normalizePriorityOrder(reorderedGameEntries, updatedAt);
}

function normalizePriorityOrder(sortedGameEntries: GameEntry[], updatedAt: string): GameEntry[] {
  return sortedGameEntries.map((gameEntry, index) => {
    const nextPriorityOrder = index + 1;

    if (gameEntry.priorityOrder === nextPriorityOrder) {
      return gameEntry;
    }

    return {
      ...gameEntry,
      priorityOrder: nextPriorityOrder,
      updatedAt,
    };
  });
}
