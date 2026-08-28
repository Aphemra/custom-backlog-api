import type { DatabaseSync } from "node:sqlite";
import type {
  IgdbCompany,
  IgdbGameType,
  IgdbNamedEntity,
  IgdbRelease,
} from "../igdb/igdbTypes.js";
import { LibraryGameRepository } from "./libraryGameRepository.js";
import type { PlayStationPlatform } from "./libraryGameTypes.js";
import type {
  LibraryGameDetails,
  LibraryGameDetailsImage,
  LibraryGameIgdbDetails,
  LibraryGamePlayStationDetails,
} from "./libraryGameDetailsTypes.js";

interface IgdbDetailsRow {
  metadata_id: string;
  external_id: string;
  title: string;
  release_date: string | null;
  fetched_at: string;
  slug: string | null;
  igdb_url: string | null;
  summary: string | null;
  storyline: string | null;
  platforms_json: string;
  releases_json: string;
  genres_json: string;
  game_modes_json: string;
  companies_json: string;
  collections_json: string;
  franchises_json: string;
  game_type_external_id: string;
  game_type_name: string | null;
  parent_game_external_id: string | null;
  version_title: string | null;
  total_rating: number | null;
  total_rating_count: number;
  time_hastily_seconds: number | null;
  time_normally_seconds: number | null;
  time_completely_seconds: number | null;
  time_submission_count: number;
  provider_updated_at: string | null;
  stored_at: string;
}

interface IgdbImageRow {
  image_id: string;
  role: "cover" | "screenshot" | "artwork";
  width: number | null;
  height: number | null;
}

interface PlayStationDetailsRow {
  np_communication_id: string;
  np_service_name: "trophy" | "trophy2";
  psn_title_name: string;
  platforms_json: string;
  first_seen_at: string;
  last_seen_at: string;
}

function readArray<Value>(value: string, field: string): readonly Value[] {
  const parsed = JSON.parse(value) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error(`${field} did not contain a JSON array.`);
  }

  return parsed as readonly Value[];
}

function mapImage(row: IgdbImageRow): LibraryGameDetailsImage {
  return {
    imageId: row.image_id,
    url: `/api/images/${row.image_id}`,
    width: row.width,
    height: row.height,
  };
}

export class LibraryGameDetailsRepository {
  private readonly libraryRepository: LibraryGameRepository;

  constructor(private readonly database: DatabaseSync) {
    this.libraryRepository = new LibraryGameRepository(database);
  }

  findById(gameId: string): LibraryGameDetails | null {
    const game = this.libraryRepository.findById(gameId);

    if (game === null) {
      return null;
    }

    return {
      game,
      igdb: this.findIgdbDetails(gameId),
      playStation: this.findPlayStationDetails(gameId),
    };
  }

  private findIgdbDetails(gameId: string): LibraryGameIgdbDetails | null {
    const row = this.database
      .prepare(
        `
          SELECT
            igdb_game_details.metadata_id,
            external_game_metadata.external_id,
            external_game_metadata.title,
            external_game_metadata.release_date,
            external_game_metadata.fetched_at,
            igdb_game_details.slug,
            igdb_game_details.igdb_url,
            igdb_game_details.summary,
            igdb_game_details.storyline,
            igdb_game_details.platforms_json,
            igdb_game_details.releases_json,
            igdb_game_details.genres_json,
            igdb_game_details.game_modes_json,
            igdb_game_details.companies_json,
            igdb_game_details.collections_json,
            igdb_game_details.franchises_json,
            igdb_game_details.game_type_external_id,
            igdb_game_details.game_type_name,
            igdb_game_details.parent_game_external_id,
            igdb_game_details.version_title,
            igdb_game_details.total_rating,
            igdb_game_details.total_rating_count,
            igdb_game_details.time_hastily_seconds,
            igdb_game_details.time_normally_seconds,
            igdb_game_details.time_completely_seconds,
            igdb_game_details.time_submission_count,
            igdb_game_details.provider_updated_at,
            igdb_game_details.stored_at
          FROM game_metadata_links
          INNER JOIN external_game_metadata
            ON external_game_metadata.id = game_metadata_links.metadata_id
          INNER JOIN igdb_game_details
            ON igdb_game_details.metadata_id = external_game_metadata.id
          WHERE
            game_metadata_links.game_id = ?
            AND external_game_metadata.provider = 'igdb'
        `,
      )
      .get(gameId) as unknown as IgdbDetailsRow | undefined;

    if (row === undefined) {
      return null;
    }

    const images = this.database
      .prepare(
        `
          SELECT
            igdb_metadata_images.image_id,
            igdb_metadata_images.role,
            igdb_metadata_images.width,
            igdb_metadata_images.height
          FROM igdb_metadata_images
          WHERE igdb_metadata_images.metadata_id = ?
          ORDER BY
            CASE igdb_metadata_images.role
              WHEN 'cover' THEN 0
              WHEN 'screenshot' THEN 1
              ELSE 2
            END,
            igdb_metadata_images.sort_order,
            igdb_metadata_images.image_id
        `,
      )
      .all(row.metadata_id) as unknown as IgdbImageRow[];

    const mappedImages = images.map((image) => ({
      role: image.role,
      image: mapImage(image),
    }));

    const timeToBeat =
      row.time_hastily_seconds === null &&
      row.time_normally_seconds === null &&
      row.time_completely_seconds === null &&
      row.time_submission_count === 0
        ? null
        : {
            hastilySeconds: row.time_hastily_seconds,
            normallySeconds: row.time_normally_seconds,
            completelySeconds: row.time_completely_seconds,
            submissionCount: row.time_submission_count,
          };

    return {
      externalId: row.external_id,
      title: row.title,
      slug: row.slug,
      igdbUrl: row.igdb_url,
      summary: row.summary,
      storyline: row.storyline,
      platforms: readArray<PlayStationPlatform>(
        row.platforms_json,
        "IGDB platforms",
      ),
      releaseDate: row.release_date,
      releases: readArray<IgdbRelease>(row.releases_json, "IGDB releases"),
      genres: readArray<IgdbNamedEntity>(row.genres_json, "IGDB genres"),
      gameModes: readArray<IgdbNamedEntity>(
        row.game_modes_json,
        "IGDB game modes",
      ),
      companies: readArray<IgdbCompany>(row.companies_json, "IGDB companies"),
      collections: readArray<IgdbNamedEntity>(
        row.collections_json,
        "IGDB collections",
      ),
      franchises: readArray<IgdbNamedEntity>(
        row.franchises_json,
        "IGDB franchises",
      ),
      gameType: {
        externalId: row.game_type_external_id,
        name: row.game_type_name,
      } satisfies IgdbGameType,
      parentGameId: row.parent_game_external_id,
      versionTitle: row.version_title,
      totalRating: row.total_rating,
      totalRatingCount: row.total_rating_count,
      timeToBeat,
      images: {
        cover:
          mappedImages.find((entry) => entry.role === "cover")?.image ?? null,
        screenshots: mappedImages
          .filter((entry) => entry.role === "screenshot")
          .map((entry) => entry.image),
        artworks: mappedImages
          .filter((entry) => entry.role === "artwork")
          .map((entry) => entry.image),
      },
      providerUpdatedAt: row.provider_updated_at,
      fetchedAt: row.fetched_at,
      storedAt: row.stored_at,
    };
  }

  private findPlayStationDetails(
    gameId: string,
  ): LibraryGamePlayStationDetails | null {
    const row = this.database
      .prepare(
        `
          SELECT
            np_communication_id,
            np_service_name,
            psn_title_name,
            platforms_json,
            first_seen_at,
            last_seen_at
          FROM playstation_game_links
          WHERE game_id = ?
        `,
      )
      .get(gameId) as unknown as PlayStationDetailsRow | undefined;

    return row === undefined
      ? null
      : {
          npCommunicationId: row.np_communication_id,
          npServiceName: row.np_service_name,
          titleName: row.psn_title_name,
          platforms: readArray<PlayStationPlatform>(
            row.platforms_json,
            "PlayStation platforms",
          ),
          firstSeenAt: row.first_seen_at,
          lastSeenAt: row.last_seen_at,
        };
  }
}
