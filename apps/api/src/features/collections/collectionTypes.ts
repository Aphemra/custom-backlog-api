import type { LibraryGame } from "../library/libraryGameTypes.js";

export interface CollectionSummary {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly sortOrder: number;
  readonly gameCount: number;
  readonly activeGameCount: number;
  readonly archivedGameCount: number;
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
