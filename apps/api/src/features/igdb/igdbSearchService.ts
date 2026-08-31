import type { DatabaseSync } from "node:sqlite";
import { ImageCacheService } from "../imageCache/imageCacheService.js";
import type { PlayStationPlatform } from "../library/libraryGameTypes.js";
import { IgdbClient } from "./igdbClient.js";
import type { IgdbGameSearchResult, IgdbSearchOptions } from "./igdbTypes.js";

interface LibraryPlatformRow {
  platform: PlayStationPlatform;
}

export class IgdbSearchService {
  constructor(
    private readonly database: DatabaseSync,
    private readonly client: IgdbClient,
    private readonly imageCache: ImageCacheService,
  ) {}

  async search(
    searchTerm: string,
    options: IgdbSearchOptions,
  ): Promise<readonly IgdbGameSearchResult[]> {
    const games = await this.client.searchGames(searchTerm, options);

    return games.map((game) => {
      const screenshots = game.screenshots.map((reference) => {
        const image = this.imageCache.register({
          provider: "igdb",
          sourceKey: `screenshot:${reference.imageId}`,
          sourceUrl: createIgdbMediaUrl(reference.imageId),
        });

        return {
          ...reference,
          imageId: image.id,
        };
      });

      const libraryPlatforms = this.findLibraryPlatforms(game.externalId);

      const { coverImageId, payload: _payload, ...searchResult } = game;

      if (game.coverImageId === null) {
        return {
          ...searchResult,
          screenshots,
          libraryPlatforms,
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
        screenshots,
        libraryPlatforms,
        cover: {
          imageId: image.id,
          url: `/api/images/${image.id}`,
        },
      };
    });
  }

  private findLibraryPlatforms(
    externalId: string,
  ): readonly PlayStationPlatform[] {
    const rows = this.database
      .prepare(
        `
        SELECT DISTINCT library_games.platform
        FROM library_games
        INNER JOIN game_metadata_links
          ON game_metadata_links.game_id = library_games.id
        INNER JOIN external_game_metadata
          ON external_game_metadata.id = game_metadata_links.metadata_id
        WHERE
          external_game_metadata.provider = 'igdb'
          AND external_game_metadata.external_id = ?
        ORDER BY CASE library_games.platform
          WHEN 'PS3' THEN 1
          WHEN 'PS4' THEN 2
          WHEN 'PS5' THEN 3
        END
      `,
      )
      .all(externalId) as unknown as LibraryPlatformRow[];

    return rows.map((row) => row.platform);
  }
}

export function createIgdbCoverUrl(coverImageId: string): string {
  return (
    `https://images.igdb.com/igdb/image/upload/` +
    `t_cover_big_2x/${coverImageId}.jpg`
  );
}

export function createIgdbMediaUrl(imageId: string): string {
  return (
    `https://images.igdb.com/igdb/image/upload/` + `t_1080p/${imageId}.jpg`
  );
}
