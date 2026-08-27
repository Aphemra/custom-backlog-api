import { PlayStationTrophyArtworkService } from "./playStationTrophyArtworkService.js";
import { PlayStationTrophyDetailFetchService } from "./playStationTrophyDetailFetchService.js";
import { PlayStationTrophyDetailRepository } from "./playStationTrophyDetailRepository.js";
import { PlayStationTrophyDetailSyncPlanner } from "./playStationTrophyDetailSyncPlanner.js";
import type { LinkedPlayStationTitlePreviewResult } from "./playStationTypes.js";

export interface PlayStationTrophyDetailSynchronizationResult {
  fullRefreshCount: number;
  earningsOnlyRefreshCount: number;
  unchangedCount: number;
  requestsMade: number;
  retriesUsed: number;
  artworkReferenceCount: number;
  uniqueArtworkImageCount: number;
  artworkAttachedCount: number;
  artworkFailedCount: number;
  artworkDownloadedCount: number;
  artworkNotModifiedCount: number;
}

export class PlayStationTrophyDetailSyncService {
  constructor(
    private readonly planner: PlayStationTrophyDetailSyncPlanner,
    private readonly fetcher: PlayStationTrophyDetailFetchService,
    private readonly repository: PlayStationTrophyDetailRepository,
    private readonly artworkService: PlayStationTrophyArtworkService,
  ) {}

  async synchronize(
    preview: LinkedPlayStationTitlePreviewResult,
  ): Promise<PlayStationTrophyDetailSynchronizationResult> {
    const plan = this.planner.plan(preview);
    const gamesNeedingArtwork: string[] = [];

    let requestsMade = 0;
    let retriesUsed = 0;

    for (const item of plan.items) {
      if (item.mode === "none") {
        continue;
      }

      if (item.mode === "full") {
        const result = await this.fetcher.fetchTitle(
          preview.target.accountId,
          item.title,
        );

        this.repository.storeFull(
          item.gameId,
          preview.target.accountId,
          item.title,
          result,
        );

        requestsMade += result.requestsMade;
        retriesUsed += result.retriesUsed;
        gamesNeedingArtwork.push(item.gameId);

        continue;
      }

      const result = await this.fetcher.fetchEarningsOnly(
        preview.target.accountId,
        item.title,
      );

      this.repository.storeEarningsOnly(
        item.gameId,
        preview.target.accountId,
        item.title,
        result,
      );

      requestsMade += result.requestsMade;
      retriesUsed += result.retriesUsed;
    }

    let artworkReferenceCount = 0;
    let uniqueArtworkImageCount = 0;
    let artworkAttachedCount = 0;
    let artworkFailedCount = 0;
    let artworkDownloadedCount = 0;
    let artworkNotModifiedCount = 0;

    for (const gameId of gamesNeedingArtwork) {
      const artwork = await this.artworkService.cacheGame(gameId);

      artworkReferenceCount += artwork.referenceCount;
      uniqueArtworkImageCount += artwork.uniqueImageCount;
      artworkAttachedCount += artwork.attachedCount;
      artworkFailedCount += artwork.failedCount;
      artworkDownloadedCount += artwork.downloadedCount;
      artworkNotModifiedCount += artwork.notModifiedCount;
    }

    return {
      fullRefreshCount: plan.fullRefreshCount,
      earningsOnlyRefreshCount: plan.earningsOnlyCount,
      unchangedCount: plan.unchangedCount,
      requestsMade,
      retriesUsed,
      artworkReferenceCount,
      uniqueArtworkImageCount,
      artworkAttachedCount,
      artworkFailedCount,
      artworkDownloadedCount,
      artworkNotModifiedCount,
    };
  }
}
