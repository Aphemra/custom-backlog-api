import type { LibraryGame } from "../library/libraryGameTypes.js";
import type { PlayStationTrophyCounts } from "../playstation/playStationTypes.js";

export interface CollectionTimeEstimateTotal {
  readonly gameCount: number;
  readonly totalSeconds: number;
}

export interface CollectionTimeEstimateSummary {
  readonly gameCountWithEstimates: number;
  readonly hastily: CollectionTimeEstimateTotal;
  readonly normally: CollectionTimeEstimateTotal;
  readonly completely: CollectionTimeEstimateTotal;
  readonly submissionCount: number;
}

export interface CollectionTrophySummary {
  readonly gameCountWithTrophies: number;
  readonly completedGameCount: number;
  readonly earnedTrophies: PlayStationTrophyCounts;
  readonly totalTrophies: PlayStationTrophyCounts;
  readonly points: {
    readonly earned: number;
    readonly total: number;
    readonly remaining: number;
  };
}

export interface CollectionSummary {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly sortOrder: number;
  readonly isPinned: boolean;
  readonly gameCount: number;
  readonly visibleGameCount: number;
  readonly hiddenGameCount: number;
  readonly trophySummary: CollectionTrophySummary | null;
  readonly timeEstimateSummary: CollectionTimeEstimateSummary | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CollectionGame extends LibraryGame {
  readonly collectionSortOrder: number;
  readonly addedAt: string;
}

export interface CollectionDetail extends CollectionSummary {
  readonly games: readonly CollectionGame[];
}

export interface CreateCollectionInput {
  readonly name: string;
  readonly description?: string | null;
}

export interface UpdateCollectionInput {
  readonly name?: string;
  readonly description?: string | null;
}
