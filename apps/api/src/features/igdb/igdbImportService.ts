import type { DatabaseSync } from "node:sqlite";
import { HttpError } from "../../errors/httpError.js";
import { ImageCacheService } from "../imageCache/imageCacheService.js";
import { BacklogActivityRecorder } from "../history/backlogActivityRecorder.js";
import { LibraryGameRepository } from "../library/libraryGameRepository.js";
import type { LibraryGame } from "../library/libraryGameTypes.js";
import { IgdbClient } from "./igdbClient.js";
import { IgdbImageRegistrationService } from "./igdbImageRegistrationService.js";
import { IgdbMetadataRepository } from "./igdbMetadataRepository.js";
import type { AddIgdbGameInput } from "./igdbTypes.js";

interface DuplicateGameRow {
  id: string;
}

export class IgdbImportService {
  private readonly libraryRepository: LibraryGameRepository;
  private readonly metadataRepository: IgdbMetadataRepository;
  private readonly imageRegistration: IgdbImageRegistrationService;
  private readonly activity: BacklogActivityRecorder;

  constructor(
    private readonly database: DatabaseSync,
    private readonly client: IgdbClient,
    private readonly imageCache: ImageCacheService,
  ) {
    this.libraryRepository = new LibraryGameRepository(database);
    this.metadataRepository = new IgdbMetadataRepository(database);
    this.activity = new BacklogActivityRecorder(database);
    this.imageRegistration = new IgdbImageRegistrationService(
      database,
      imageCache,
    );
  }

  async addToLibrary(input: AddIgdbGameInput): Promise<LibraryGame> {
    const igdbGame = await this.client.getGame(input.externalId);

    if (igdbGame === null) {
      throw new HttpError(
        404,
        "igdb_game_not_found",
        "The selected IGDB game could not be found.",
      );
    }

    if (!igdbGame.platforms.includes(input.platform)) {
      throw new HttpError(
        409,
        "igdb_platform_mismatch",
        `${igdbGame.title} is not listed for ${input.platform} by IGDB.`,
      );
    }

    this.database.exec("BEGIN IMMEDIATE");

    try {
      const duplicate = this.database
        .prepare(
          `
          SELECT library_games.id
          FROM library_games
          INNER JOIN game_metadata_links
            ON game_metadata_links.game_id = library_games.id
          INNER JOIN external_game_metadata
            ON external_game_metadata.id = game_metadata_links.metadata_id
          WHERE
            external_game_metadata.provider = 'igdb'
            AND external_game_metadata.external_id = ?
            AND library_games.platform = ?
          LIMIT 1
        `,
        )
        .get(input.externalId, input.platform) as DuplicateGameRow | undefined;

      if (duplicate !== undefined) {
        throw new HttpError(
          409,
          "igdb_game_already_added",
          `${igdbGame.title} is already in the ${input.platform} backlog.`,
        );
      }

      const timestamp = new Date().toISOString();

      const releaseTimestamp =
        igdbGame.releaseDate === null
          ? Number.NaN
          : Date.parse(igdbGame.releaseDate);

      const playStatus =
        igdbGame.releaseDate === null ||
        (Number.isFinite(releaseTimestamp) &&
          releaseTimestamp > Date.parse(timestamp))
          ? "unreleased"
          : input.playStatus;

      const libraryGame = this.libraryRepository.create({
        title: igdbGame.title,
        platform: input.platform,
        playStatus,
        notes: null,
      });

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
        .run(libraryGame.id, metadataId, timestamp);

      this.imageRegistration.replaceForGame(
        libraryGame.id,
        metadataId,
        igdbGame,
        timestamp,
      );

      this.activity.recordGameAdded(libraryGame, timestamp);

      this.database.exec("COMMIT");

      return libraryGame;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}
