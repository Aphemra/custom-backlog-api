import { createHash } from "node:crypto";
import { HttpError } from "../../errors/httpError.js";
import { ImageCacheService } from "../imageCache/imageCacheService.js";
import type {
  ReconciledPlayStationTitle,
  ReconciledPlayStationTitlePreviewResult,
} from "./playStationTypes.js";

function createSourceKey(title: ReconciledPlayStationTitle): string {
  const sourceHash = createHash("sha256")
    .update(title.iconUrl)
    .digest("hex")
    .slice(0, 16);

  return [
    "trophy-title",
    title.npServiceName,
    title.npCommunicationId,
    sourceHash,
  ].join(":");
}

export class PlayStationTitleImageService {
  constructor(private readonly imageCache: ImageCacheService) {}

  attachCachedIcons(
    preview: ReconciledPlayStationTitlePreviewResult,
  ): ReconciledPlayStationTitlePreviewResult {
    return {
      ...preview,
      titles: preview.titles.map((title) => {
        try {
          const image = this.imageCache.register({
            provider: "playstation",
            sourceKey: createSourceKey(title),
            sourceUrl: title.iconUrl,
          });

          return {
            ...title,
            cachedIcon: {
              imageId: image.id,
              url: `/api/images/${image.id}`,
            },
          };
        } catch (error) {
          if (
            error instanceof HttpError &&
            error.code === "invalid_image_source"
          ) {
            return {
              ...title,
              cachedIcon: null,
            };
          }

          throw error;
        }
      }),
    };
  }
}
