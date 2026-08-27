import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { HttpError } from "../../errors/httpError.js";
import { ImageCacheService } from "../imageCache/imageCacheService.js";
import { LibraryGameRepository } from "../library/libraryGameRepository.js";
import type {
  LibraryGame,
  PlayStationPlatform,
} from "../library/libraryGameTypes.js";
import { IgdbClient } from "./igdbClient.js";
import { createIgdbCoverUrl } from "./igdbSearchService.js";

interface LibraryGameRow {
  id: string;
  platform: PlayStationPlatform;
}

interface MetadataIdRow {
  id: string;
}

interface ExistingMetadataLinkRow {
  provider: string;
  external_id: string;
}

export interface IgdbEnrichmentResult {
  game: LibraryGame;
  metadata: {
    provider: "igdb";
    externalId: string;
    title: string;
    releaseDate: string | null;
    cover: {
      imageId: string;
      url: string;
    } | null;
  };
}

export class IgdbEnrichmentService {
  constructor(
    private readonly database: DatabaseSync,
    private readonly client: IgdbClient,
    private readonly imageCache: ImageCacheService,
  ) {}

  async enrichExistingGame(
    gameId: string,
    externalId: string,
  ): Promise<IgdbEnrichmentResult> {
    const gameRow = this.database
      .prepare(
        `
        SELECT id, platform
        FROM library_games
        WHERE id = ?
      `,
      )
      .get(gameId) as unknown as LibraryGameRow | undefined;

    if (gameRow === undefined) {
      throw new HttpError(
        404,
        "game_not_found",
        "The selected library game was not found.",
      );
    }

    const existingLink = this.database
      .prepare(
        `
        SELECT
          external_game_metadata.provider,
          external_game_metadata.external_id
        FROM game_metadata_links
        INNER JOIN external_game_metadata
          ON external_game_metadata.id =
            game_metadata_links.metadata_id
        WHERE game_metadata_links.game_id = ?
      `,
      )
      .get(gameId) as unknown as ExistingMetadataLinkRow | undefined;

    if (existingLink !== undefined) {
      throw new HttpError(
        409,
        "game_metadata_already_linked",
        `This library game is already linked to ${existingLink.provider} metadata.`,
      );
    }

    const igdbGame = await this.client.getGame(externalId);

    if (igdbGame === null) {
      throw new HttpError(
        404,
        "igdb_game_not_found",
        "The selected IGDB game could not be found.",
      );
    }

    if (!igdbGame.platforms.includes(gameRow.platform)) {
      throw new HttpError(
        409,
        "igdb_platform_mismatch",
        `${igdbGame.title} is not listed for ${gameRow.platform} by IGDB.`,
      );
    }

    this.database.exec("BEGIN IMMEDIATE");

    try {
      const timestamp = new Date().toISOString();

      const coverUrl =
        igdbGame.coverImageId === null
          ? null
          : createIgdbCoverUrl(igdbGame.coverImageId);

      const existingMetadata = this.database
        .prepare(
          `
          SELECT id
          FROM external_game_metadata
          WHERE
            provider = 'igdb'
            AND external_id = ?
        `,
        )
        .get(externalId) as unknown as MetadataIdRow | undefined;

      const metadataId = existingMetadata?.id ?? randomUUID();

      if (existingMetadata === undefined) {
        this.database
          .prepare(
            `
            INSERT INTO external_game_metadata (
              id,
              provider,
              external_id,
              title,
              cover_url,
              release_date,
              payload_json,
              fetched_at
            ) VALUES (?, 'igdb', ?, ?, ?, ?, ?, ?)
          `,
          )
          .run(
            metadataId,
            externalId,
            igdbGame.title,
            coverUrl,
            igdbGame.releaseDate,
            JSON.stringify(igdbGame.payload),
            timestamp,
          );
      } else {
        this.database
          .prepare(
            `
            UPDATE external_game_metadata
            SET
              title = ?,
              cover_url = ?,
              release_date = ?,
              payload_json = ?,
              fetched_at = ?
            WHERE id = ?
          `,
          )
          .run(
            igdbGame.title,
            coverUrl,
            igdbGame.releaseDate,
            JSON.stringify(igdbGame.payload),
            timestamp,
            metadataId,
          );
      }

      this.database
        .prepare(
          `
          INSERT INTO game_metadata_links (
            game_id,
            metadata_id,
            linked_at
          ) VALUES (?, ?, ?)
        `,
        )
        .run(gameId, metadataId, timestamp);

      let cover: IgdbEnrichmentResult["metadata"]["cover"] = null;

      if (igdbGame.coverImageId !== null && coverUrl !== null) {
        const image = this.imageCache.register({
          provider: "igdb",
          sourceKey: `cover:${igdbGame.coverImageId}`,
          sourceUrl: coverUrl,
        });

        this.database
          .prepare(
            `
            INSERT INTO library_game_images (
              game_id,
              image_id,
              role,
              sort_order,
              linked_at
            ) VALUES (?, ?, 'cover', 0, ?)
          `,
          )
          .run(gameId, image.id, timestamp);

        cover = {
          imageId: image.id,
          url: `/api/images/${image.id}`,
        };
      }

      this.database.exec("COMMIT");

      const game = new LibraryGameRepository(this.database).findById(gameId);

      if (game === null) {
        throw new Error(
          `Library game ${gameId} disappeared after IGDB enrichment.`,
        );
      }

      return {
        game,
        metadata: {
          provider: "igdb",
          externalId,
          title: igdbGame.title,
          releaseDate: igdbGame.releaseDate,
          cover,
        },
      };
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}
