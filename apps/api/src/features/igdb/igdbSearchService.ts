import { ImageCacheService } from "../imageCache/imageCacheService.js";
import { IgdbClient } from "./igdbClient.js";
import type { IgdbGameSearchResult, IgdbSearchOptions } from "./igdbTypes.js";

export class IgdbSearchService {
  constructor(
    private readonly client: IgdbClient,
    private readonly imageCache: ImageCacheService,
  ) {}

  async search(
    searchTerm: string,
    options: IgdbSearchOptions,
  ): Promise<readonly IgdbGameSearchResult[]> {
    const games = await this.client.searchGames(searchTerm, options);

    return games.map((game) => {
      const { coverImageId, payload: _payload, ...searchResult } = game;

      if (game.coverImageId === null) {
        return {
          ...searchResult,
          cover: null,
        };
      }

      const image = this.imageCache.register({
        provider: "igdb",
        sourceKey: `cover:${game.coverImageId}`,
        sourceUrl: createIgdbCoverUrl(game.coverImageId),
      });

      return {
        ...searchResult,
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
