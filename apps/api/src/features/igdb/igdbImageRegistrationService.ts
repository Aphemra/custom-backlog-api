import type { DatabaseSync } from "node:sqlite";
import { ImageCacheService } from "../imageCache/imageCacheService.js";
import { createIgdbCoverUrl, createIgdbMediaUrl } from "./igdbSearchService.js";
import type { IgdbGame, IgdbImageReference } from "./igdbTypes.js";

export type IgdbRegisteredImageRole = "cover" | "screenshot" | "artwork";

export interface IgdbRegisteredImage {
  imageId: string;
  url: string;
  width: number | null;
  height: number | null;
}

export interface IgdbRegisteredImages {
  cover: IgdbRegisteredImage | null;
  screenshots: readonly IgdbRegisteredImage[];
  artworks: readonly IgdbRegisteredImage[];
}

interface ImageLink {
  imageId: string;
  role: IgdbRegisteredImageRole;
  sortOrder: number;
  width: number | null;
  height: number | null;
}

export class IgdbImageRegistrationService {
  constructor(
    private readonly database: DatabaseSync,
    private readonly imageCache: ImageCacheService,
  ) {}

  replaceForGame(
    gameId: string,
    metadataId: string,
    game: IgdbGame,
    linkedAt: string,
  ): IgdbRegisteredImages {
    const cover =
      game.coverImageId === null ? null : this.registerCover(game.coverImageId);

    const screenshots = game.screenshots.map((reference) =>
      this.registerMedia("screenshot", reference),
    );

    const artworks = game.artworks.map((reference) =>
      this.registerMedia("artwork", reference),
    );

    const links: ImageLink[] = [
      ...(cover === null
        ? []
        : [
            {
              imageId: cover.imageId,
              role: "cover" as const,
              sortOrder: 0,
              width: cover.width,
              height: cover.height,
            },
          ]),
      ...screenshots.map((image, sortOrder) => ({
        imageId: image.imageId,
        role: "screenshot" as const,
        sortOrder,
        width: image.width,
        height: image.height,
      })),
      ...artworks.map((image, sortOrder) => ({
        imageId: image.imageId,
        role: "artwork" as const,
        sortOrder,
        width: image.width,
        height: image.height,
      })),
    ];

    this.database
      .prepare("DELETE FROM igdb_metadata_images WHERE metadata_id = ?")
      .run(metadataId);

    const insertMetadataImage = this.database.prepare(`
      INSERT INTO igdb_metadata_images (
        metadata_id,
        image_id,
        role,
        sort_order,
        width,
        height,
        linked_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const link of links) {
      insertMetadataImage.run(
        metadataId,
        link.imageId,
        link.role,
        link.sortOrder,
        link.width,
        link.height,
        linkedAt,
      );
    }

    this.database
      .prepare(
        `
          DELETE FROM library_game_images
          WHERE
            game_id = ?
            AND role = 'cover'
            AND image_id IN (
              SELECT id
              FROM cached_images
              WHERE provider = 'igdb'
            )
        `,
      )
      .run(gameId);

    if (cover !== null) {
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
        .run(gameId, cover.imageId, linkedAt);
    }

    return {
      cover,
      screenshots,
      artworks,
    };
  }

  private registerCover(coverImageId: string): IgdbRegisteredImage {
    const image = this.imageCache.register({
      provider: "igdb",
      sourceKey: `cover:${coverImageId}`,
      sourceUrl: createIgdbCoverUrl(coverImageId),
    });

    return {
      imageId: image.id,
      url: `/api/images/${image.id}`,
      width: null,
      height: null,
    };
  }

  private registerMedia(
    role: "screenshot" | "artwork",
    reference: IgdbImageReference,
  ): IgdbRegisteredImage {
    const image = this.imageCache.register({
      provider: "igdb",
      sourceKey: `${role}:${reference.imageId}`,
      sourceUrl: createIgdbMediaUrl(reference.imageId),
    });

    return {
      imageId: image.id,
      url: `/api/images/${image.id}`,
      width: reference.width,
      height: reference.height,
    };
  }
}
