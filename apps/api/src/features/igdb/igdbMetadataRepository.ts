import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { createIgdbCoverUrl } from "./igdbSearchService.js";
import type { IgdbGame } from "./igdbTypes.js";

interface MetadataIdRow {
  id: string;
}

export interface StoredIgdbMetadata {
  metadataId: string;
  coverUrl: string | null;
}

export class IgdbMetadataRepository {
  constructor(private readonly database: DatabaseSync) {}

  upsert(game: IgdbGame, storedAt: string): StoredIgdbMetadata {
    const coverUrl =
      game.coverImageId === null ? null : createIgdbCoverUrl(game.coverImageId);

    const existingMetadata = this.database
      .prepare(
        `
          SELECT id
          FROM external_game_metadata
          WHERE provider = 'igdb' AND external_id = ?
        `,
      )
      .get(game.externalId) as MetadataIdRow | undefined;

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
          game.externalId,
          game.title,
          coverUrl,
          game.releaseDate,
          JSON.stringify(game.payload),
          storedAt,
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
          game.title,
          coverUrl,
          game.releaseDate,
          JSON.stringify(game.payload),
          storedAt,
          metadataId,
        );
    }

    this.database
      .prepare(
        `
          INSERT INTO igdb_game_details (
            metadata_id,
            slug,
            igdb_url,
            summary,
            storyline,
            platforms_json,
            releases_json,
            cover_image_id,
            screenshots_json,
            artworks_json,
            genres_json,
            game_modes_json,
            companies_json,
            collections_json,
            franchises_json,
            game_type_external_id,
            game_type_name,
            parent_game_external_id,
            version_title,
            total_rating,
            total_rating_count,
            time_hastily_seconds,
            time_normally_seconds,
            time_completely_seconds,
            time_submission_count,
            provider_updated_at,
            is_dlc,
            stored_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?
          )
          ON CONFLICT(metadata_id) DO UPDATE SET
            slug = excluded.slug,
            igdb_url = excluded.igdb_url,
            summary = excluded.summary,
            storyline = excluded.storyline,
            platforms_json = excluded.platforms_json,
            releases_json = excluded.releases_json,
            cover_image_id = excluded.cover_image_id,
            screenshots_json = excluded.screenshots_json,
            artworks_json = excluded.artworks_json,
            genres_json = excluded.genres_json,
            game_modes_json = excluded.game_modes_json,
            companies_json = excluded.companies_json,
            collections_json = excluded.collections_json,
            franchises_json = excluded.franchises_json,
            game_type_external_id = excluded.game_type_external_id,
            game_type_name = excluded.game_type_name,
            parent_game_external_id = excluded.parent_game_external_id,
            version_title = excluded.version_title,
            total_rating = excluded.total_rating,
            total_rating_count = excluded.total_rating_count,
            time_hastily_seconds = excluded.time_hastily_seconds,
            time_normally_seconds = excluded.time_normally_seconds,
            time_completely_seconds = excluded.time_completely_seconds,
            time_submission_count = excluded.time_submission_count,
            provider_updated_at = excluded.provider_updated_at,
            is_dlc = excluded.is_dlc,
            stored_at = excluded.stored_at
        `,
      )
      .run(
        metadataId,
        game.slug,
        game.igdbUrl,
        game.summary,
        game.storyline,
        JSON.stringify(game.platforms),
        JSON.stringify(game.releases),
        game.coverImageId,
        JSON.stringify(game.screenshots),
        JSON.stringify(game.artworks),
        JSON.stringify(game.genres),
        JSON.stringify(game.gameModes),
        JSON.stringify(game.companies),
        JSON.stringify(game.collections),
        JSON.stringify(game.franchises),
        game.gameType.externalId,
        game.gameType.name,
        game.parentGameId,
        game.versionTitle,
        game.totalRating,
        game.totalRatingCount,
        game.timeToBeat?.hastilySeconds ?? null,
        game.timeToBeat?.normallySeconds ?? null,
        game.timeToBeat?.completelySeconds ?? null,
        game.timeToBeat?.submissionCount ?? 0,
        game.providerUpdatedAt,
        game.isDlc ? 1 : 0,
        storedAt,
      );

    return {
      metadataId,
      coverUrl,
    };
  }
}
