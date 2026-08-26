import { ImageCacheService } from "../imageCache/imageCacheService.js";
import { IgdbClient } from "./igdbClient.js";
import type { IgdbGameSearchResult } from "./igdbTypes.js";

export class IgdbSearchService {
  constructor(
    private readonly client: IgdbClient,
    private readonly imageCache: ImageCacheService,
  ) {}

  async search(
    searchTerm: string,
    includeDlc = false,
  ): Promise<readonly IgdbGameSearchResult[]> {
    const games = await this.client.searchGames(searchTerm, includeDlc);

    return games.map((game) => {
      if (game.coverImageId === null) {
        return {
          externalId: game.externalId,
          title: game.title,
          summary: game.summary,
          platforms: game.platforms,
          releaseDate: game.releaseDate,
          isDlc: game.isDlc,
          cover: null,
        };
      }

      const image = this.imageCache.register({
        provider: "igdb",
        sourceKey: `cover:${game.coverImageId}`,
        sourceUrl: createIgdbCoverUrl(game.coverImageId),
      });

      return {
        externalId: game.externalId,
        title: game.title,
        summary: game.summary,
        platforms: game.platforms,
        releaseDate: game.releaseDate,
        isDlc: game.isDlc,
        cover: {
          imageId: image.id,
          url: `/api/images/${image.id}`,
        },
      };
    });
  }
}

export function createIgdbCoverUrl(coverImageId: string): string {
  return (
    `https://images.igdb.com/igdb/image/upload/` +
    `t_cover_big_2x/${coverImageId}.jpg`
  );
}
