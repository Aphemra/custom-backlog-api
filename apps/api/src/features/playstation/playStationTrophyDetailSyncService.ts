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

export interface PlayStationTrophyDetailSyncProgress {
  phase: "fetching_trophies" | "caching_artwork";
  completedItems: number;
  totalItems: number;
  subtaskCompletedItems: number | null;
  subtaskTotalItems: number | null;
  currentItem: string | null;
  message: string;
}

export type PlayStationTrophyDetailSyncProgressReporter = (
  progress: PlayStationTrophyDetailSyncProgress,
) => void;

interface ArtworkJob {
  gameId: string;
  missingOnly: boolean;
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
    reportProgress?: PlayStationTrophyDetailSyncProgressReporter,
  ): Promise<PlayStationTrophyDetailSynchronizationResult> {
    const plan = this.planner.plan(preview);
    const detailItems = plan.items.filter((item) => item.mode !== "none");
    const fullyRefreshedGameIds = new Set<string>();
    const titleByGameId = new Map(
      plan.items.map((item) => [item.gameId, item.title.name]),
    );

    let requestsMade = 0;
    let retriesUsed = 0;
    let completedDetailItems = 0;

    reportProgress?.({
      phase: "fetching_trophies",
      completedItems: 0,
      totalItems: detailItems.length,
      subtaskCompletedItems: null,
      subtaskTotalItems: null,
      currentItem: detailItems[0]?.title.name ?? null,
      message:
        detailItems.length === 0
          ? "All locally stored trophy details are current."
          : "Fetching detailed trophy records from PlayStation.",
    });

    for (const item of detailItems) {
      reportProgress?.({
        phase: "fetching_trophies",
        completedItems: completedDetailItems,
        totalItems: detailItems.length,
        subtaskCompletedItems: null,
        subtaskTotalItems: null,
        currentItem: item.title.name,
        message:
          item.mode === "full"
            ? "Fetching a complete trophy list."
            : "Refreshing earned-trophy details.",
      });

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
        fullyRefreshedGameIds.add(item.gameId);
      } else {
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

      completedDetailItems += 1;

      reportProgress?.({
        phase: "fetching_trophies",
        completedItems: completedDetailItems,
        totalItems: detailItems.length,
        subtaskCompletedItems: null,
        subtaskTotalItems: null,
        currentItem: item.title.name,
        message: "Stored the detailed trophy record.",
      });
    }

    const artworkJobs = new Map<string, ArtworkJob>();

    for (const gameId of fullyRefreshedGameIds) {
      artworkJobs.set(gameId, { gameId, missingOnly: true });
    }

    for (const gameId of this.artworkService.findGameIdsNeedingCache()) {
      if (!artworkJobs.has(gameId)) {
        artworkJobs.set(gameId, { gameId, missingOnly: true });
      }
    }

    const orderedArtworkJobs = [...artworkJobs.values()];

    let artworkReferenceCount = 0;
    let uniqueArtworkImageCount = 0;
    let artworkAttachedCount = 0;
    let artworkFailedCount = 0;
    let artworkDownloadedCount = 0;
    let artworkNotModifiedCount = 0;

    reportProgress?.({
      phase: "caching_artwork",
      completedItems: 0,
      totalItems: orderedArtworkJobs.length,
      subtaskCompletedItems: null,
      subtaskTotalItems: null,
      currentItem: null,
      message:
        orderedArtworkJobs.length === 0
          ? "All trophy artwork is already cached."
          : "Caching trophy artwork locally.",
    });

    for (const [index, job] of orderedArtworkJobs.entries()) {
      const storedTitle = this.repository.findByGameId(job.gameId);
      const currentTitle =
        titleByGameId.get(job.gameId) ??
        storedTitle?.titleName ??
        "Unknown trophy title";

      const artwork = await this.artworkService.cacheGame(
        job.gameId,
        (artworkProgress) => {
          reportProgress?.({
            phase: "caching_artwork",
            completedItems: index,
            totalItems: orderedArtworkJobs.length,
            subtaskCompletedItems: artworkProgress.completedReferences,
            subtaskTotalItems: artworkProgress.totalReferences,
            currentItem: currentTitle,
            message: job.missingOnly
              ? "Resuming missing trophy artwork."
              : "Caching trophy artwork locally.",
          });
        },
        job.missingOnly,
      );

      artworkReferenceCount += artwork.referenceCount;
      uniqueArtworkImageCount += artwork.uniqueImageCount;
      artworkAttachedCount += artwork.attachedCount;
      artworkFailedCount += artwork.failedCount;
      artworkDownloadedCount += artwork.downloadedCount;
      artworkNotModifiedCount += artwork.notModifiedCount;

      reportProgress?.({
        phase: "caching_artwork",
        completedItems: index + 1,
        totalItems: orderedArtworkJobs.length,
        subtaskCompletedItems: artwork.referenceCount,
        subtaskTotalItems: artwork.referenceCount,
        currentItem: currentTitle,
        message: "Finished caching artwork for this trophy title.",
      });
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
