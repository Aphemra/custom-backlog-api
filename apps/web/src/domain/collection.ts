import type { LibraryGame } from "./libraryGame";

export interface CollectionSummary {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly sortOrder: number;
  readonly gameCount: number;
  readonly visibleGameCount: number;
  readonly hiddenGameCount: number;
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

export interface CollectionInput {
  readonly name: string;
  readonly description: string | null;
}
