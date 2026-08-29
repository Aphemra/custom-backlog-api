import type { DatabaseSync } from "node:sqlite";
import { HttpError } from "../../errors/httpError.js";
import { ImageCacheService } from "../imageCache/imageCacheService.js";
import { LibraryGameRepository } from "../library/libraryGameRepository.js";
import type {
  LibraryGame,
  PlayStationPlatform,
} from "../library/libraryGameTypes.js";
import { IgdbClient } from "./igdbClient.js";
import { IgdbImageRegistrationService } from "./igdbImageRegistrationService.js";
import { IgdbMetadataRepository } from "./igdbMetadataRepository.js";

interface LibraryGameRow {
  id: string;
  platform: PlayStationPlatform;
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
  private readonly metadataRepository: IgdbMetadataRepository;
  private readonly imageRegistration: IgdbImageRegistrationService;

  constructor(
    private readonly database: DatabaseSync,
    private readonly client: IgdbClient,
    private readonly imageCache: ImageCacheService,
  ) {
    this.metadataRepository = new IgdbMetadataRepository(database);
    this.imageRegistration = new IgdbImageRegistrationService(
      database,
      imageCache,
    );
  }

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

      const { metadataId } = this.metadataRepository.upsert(
        igdbGame,
        timestamp,
      );

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

      const { cover } = this.imageRegistration.replaceForGame(
        gameId,
        metadataId,
        igdbGame,
        timestamp,
      );

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

  async refreshExistingGame(gameId: string): Promise<IgdbEnrichmentResult> {
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

    if (existingLink === undefined) {
      throw new HttpError(
        409,
        "game_metadata_not_linked",
        "This library game does not have metadata to refresh.",
      );
    }

    if (existingLink.provider !== "igdb") {
      throw new HttpError(
        409,
        "game_metadata_not_igdb",
        "Only IGDB metadata can be refreshed through this action.",
      );
    }

    const igdbGame = await this.client.getGame(existingLink.external_id);

    if (igdbGame === null) {
      throw new HttpError(
        404,
        "igdb_game_not_found",
        "The linked IGDB game could no longer be found.",
      );
    }

    if (!igdbGame.platforms.includes(gameRow.platform)) {
      throw new HttpError(
        409,
        "igdb_platform_mismatch",
        `${igdbGame.title} is no longer listed for ${gameRow.platform} by IGDB.`,
      );
    }

    this.database.exec("BEGIN IMMEDIATE");

    try {
      const timestamp = new Date().toISOString();

      const { metadataId } = this.metadataRepository.upsert(
        igdbGame,
        timestamp,
      );

      this.database
        .prepare(
          `
          UPDATE game_metadata_links
          SET linked_at = ?
          WHERE game_id = ? AND metadata_id = ?
        `,
        )
        .run(timestamp, gameId, metadataId);

      const { cover } = this.imageRegistration.replaceForGame(
        gameId,
        metadataId,
        igdbGame,
        timestamp,
      );

      this.database.exec("COMMIT");

      const game = new LibraryGameRepository(this.database).findById(gameId);

      if (game === null) {
        throw new Error(
          `Library game ${gameId} disappeared after its IGDB refresh.`,
        );
      }

      return {
        game,
        metadata: {
          provider: "igdb",
          externalId: existingLink.external_id,
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
