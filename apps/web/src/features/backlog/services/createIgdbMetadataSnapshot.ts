import type { GameExternalMetadata } from "../../../domain/externalMetadata";
import type { IgdbGameSearchResult } from "../../../services/api/igdbApi";

export function createIgdbMetadataSnapshot(game: IgdbGameSearchResult): GameExternalMetadata {
  return {
    igdb: {
      igdbId: game.id,
      name: game.name,
      platformNames: game.platforms,
      firstReleaseYear: game.firstReleaseYear,
      coverUrl: game.coverUrl,
      importedAt: new Date().toISOString(),
    },
  };
}
