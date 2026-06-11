import type { GameEntry } from "../../../domain/backlog";

export interface BacklogStats {
  totalGames: number;
  playingGames: number;
  completedGames: number;
  platinumedGames: number;
}

export function calculateBacklogStats(gameEntries: GameEntry[]): BacklogStats {
  return {
    totalGames: gameEntries.length,

    playingGames: gameEntries.filter((gameEntry) => gameEntry.playStatus === "playing").length,

    completedGames: gameEntries.filter(
      (gameEntry) => gameEntry.playStatus === "completed" || gameEntry.trophyStatus === "hundred_percent" || gameEntry.trophyStatus === "platinumed",
    ).length,

    platinumedGames: gameEntries.filter((gameEntry) => gameEntry.trophyStatus === "platinumed").length,
  };
}
