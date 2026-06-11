import type { GameEntry } from "../../../domain/backlog";

export function countGamesInBucket(gameEntries: GameEntry[], bucketId: string): number {
  return gameEntries.filter((gameEntry) => gameEntry.bucketIds.includes(bucketId)).length;
}
