import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { HttpError } from "../../errors/httpError.js";
import { ImageCacheService } from "../imageCache/imageCacheService.js";
import { PlayStationTrophyDetailRepository } from "./playStationTrophyDetailRepository.js";

export interface PlayStationTrophyArtworkCacheResult {
  referenceCount: number;
  uniqueImageCount: number;
  attachedCount: number;
  failedCount: number;
  downloadedCount: number;
  notModifiedCount: number;
}

type ArtworkKind = "set" | "group" | "trophy";

interface ArtworkReference {
  kind: ArtworkKind;
  providerId: string;
  sourceUrl: string;
  attach(imageId: string): boolean;
}

interface CachedArtworkResult {
  imageId: string;
  status: "downloaded" | "not_modified";
}

function createSourceKey(
  kind: ArtworkKind,
  npServiceName: "trophy" | "trophy2",
  npCommunicationId: string,
  providerId: string,
  sourceUrl: string,
): string {
  const sourceHash = createHash("sha256")
    .update(sourceUrl)
    .digest("hex")
    .slice(0, 16);

  if (kind === "set") {
    return ["trophy-title", npServiceName, npCommunicationId, sourceHash].join(
      ":",
    );
  }

  return [
    "trophy-artwork",
    kind,
    npServiceName,
    npCommunicationId,
    providerId,
    sourceHash,
  ].join(":");
}

export class PlayStationTrophyArtworkService {
  constructor(
    private readonly database: DatabaseSync,
    private readonly imageCache: ImageCacheService,
    private readonly trophyRepository = new PlayStationTrophyDetailRepository(
      database,
    ),
  ) {}

  async cacheGame(
    gameId: string,
  ): Promise<PlayStationTrophyArtworkCacheResult> {
    const trophySet = this.trophyRepository.findByGameId(gameId);

    if (trophySet === null) {
      throw new HttpError(
        404,
        "playstation_trophy_set_not_found",
        "No locally stored PlayStation trophy set was found for this game.",
      );
    }

    const references: ArtworkReference[] = [
      {
        kind: "set",
        providerId: "title",
        sourceUrl: trophySet.titleIconUrl,
        attach: (imageId) =>
          this.database
            .prepare(
              `
                UPDATE playstation_trophy_sets
                SET icon_image_id = ?
                WHERE game_id = ?
                  AND icon_url = ?
              `,
            )
            .run(imageId, gameId, trophySet.titleIconUrl).changes === 1,
      },
    ];

    for (const group of trophySet.groups) {
      references.push({
        kind: "group",
        providerId: group.trophyGroupId,
        sourceUrl: group.iconUrl,
        attach: (imageId) =>
          this.database
            .prepare(
              `
                UPDATE playstation_trophy_groups
                SET icon_image_id = ?
                WHERE game_id = ?
                  AND trophy_group_id = ?
                  AND icon_url = ?
              `,
            )
            .run(imageId, gameId, group.trophyGroupId, group.iconUrl)
            .changes === 1,
      });

      for (const trophy of group.trophies) {
        if (trophy.iconUrl === null) {
          continue;
        }

        const trophyIconUrl = trophy.iconUrl;

        references.push({
          kind: "trophy",
          providerId: String(trophy.trophyId),
          sourceUrl: trophyIconUrl,
          attach: (imageId) =>
            this.database
              .prepare(
                `
                  UPDATE playstation_trophies
                  SET icon_image_id = ?
                  WHERE game_id = ?
                    AND trophy_id = ?
                    AND icon_url = ?
                `,
              )
              .run(imageId, gameId, trophy.trophyId, trophyIconUrl).changes ===
            1,
        });
      }
    }

    const cachedByUrl = new Map<string, CachedArtworkResult | null>();

    let attachedCount = 0;
    let failedCount = 0;
    let downloadedCount = 0;
    let notModifiedCount = 0;

    for (const reference of references) {
      let cached = cachedByUrl.get(reference.sourceUrl);

      if (cached === undefined) {
        cached = await this.cacheReference(
          trophySet.npServiceName,
          trophySet.npCommunicationId,
          reference,
        );

        cachedByUrl.set(reference.sourceUrl, cached);

        if (cached?.status === "downloaded") {
          downloadedCount += 1;
        } else if (cached?.status === "not_modified") {
          notModifiedCount += 1;
        }
      }

      if (cached === null || !reference.attach(cached.imageId)) {
        failedCount += 1;
      } else {
        attachedCount += 1;
      }
    }

    return {
      referenceCount: references.length,
      uniqueImageCount: cachedByUrl.size,
      attachedCount,
      failedCount,
      downloadedCount,
      notModifiedCount,
    };
  }

  private async cacheReference(
    npServiceName: "trophy" | "trophy2",
    npCommunicationId: string,
    reference: ArtworkReference,
  ): Promise<CachedArtworkResult | null> {
    try {
      const registered = this.imageCache.register({
        provider: "playstation",
        sourceKey: createSourceKey(
          reference.kind,
          npServiceName,
          npCommunicationId,
          reference.providerId,
          reference.sourceUrl,
        ),
        sourceUrl: reference.sourceUrl,
      });

      const refreshed = await this.imageCache.refresh(registered.id);

      return {
        imageId: refreshed.image.id,
        status: refreshed.status,
      };
    } catch (error) {
      if (error instanceof HttpError) {
        return null;
      }

      throw error;
    }
  }
}
