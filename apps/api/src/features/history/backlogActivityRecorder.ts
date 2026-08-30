import type { DatabaseSync } from "node:sqlite";
import type { CollectionSummary } from "../collections/collectionTypes.js";
import type { LibraryGame, PlayStatus } from "../library/libraryGameTypes.js";
import type { PlayStationTrophyType } from "../playstation/playStationTypes.js";
import { BacklogHistoryRepository } from "./backlogHistoryRepository.js";
import type { BacklogHistoryActionSource } from "./historyTypes.js";

const playStatusLabels: Readonly<Record<PlayStatus, string>> = {
  unreleased: "Unreleased",
  not_started: "Not started",
  playing: "Playing",
  on_hold: "On hold",
  waiting: "Waiting",
  completed: "Completed",
};

interface BacklogTransferCounts {
  readonly libraryGames: number;
  readonly collections: number;
  readonly savedViews: number;
}

export class BacklogActivityRecorder {
  private readonly history: BacklogHistoryRepository;

  constructor(
    database: DatabaseSync,
    private readonly source: BacklogHistoryActionSource = "user",
  ) {
    this.history = new BacklogHistoryRepository(database);
  }

  recordGameAdded(game: LibraryGame, occurredAt?: string): void {
    this.history.append({
      action: "game_added",
      source: this.source,
      ...(occurredAt === undefined ? {} : { occurredAt }),
      gameId: game.id,
      gameTitle: game.title,
      summary: `Added ${game.title} to the Library.`,
      details: {
        platform: game.platform,
        playStatus: game.playStatus,
      },
    });
  }

  recordPlayStatusChanged(
    gameId: string,
    gameTitle: string,
    previousPlayStatus: PlayStatus,
    nextPlayStatus: PlayStatus,
    occurredAt?: string,
  ): void {
    if (previousPlayStatus === nextPlayStatus) {
      return;
    }

    this.history.append({
      action: "play_status_changed",
      source: this.source,
      ...(occurredAt === undefined ? {} : { occurredAt }),
      gameId,
      gameTitle,
      previousPlayStatus,
      nextPlayStatus,
      summary:
        `Changed ${gameTitle} from ` +
        `${playStatusLabels[previousPlayStatus]} to ` +
        `${playStatusLabels[nextPlayStatus]}.`,
      details: {},
    });
  }

  recordGameChanged(previous: LibraryGame, next: LibraryGame): void {
    this.recordPlayStatusChanged(
      next.id,
      next.title,
      previous.playStatus,
      next.playStatus,
    );

    if (previous.platform !== next.platform) {
      this.history.append({
        action: "game_platform_changed",
        source: this.source,
        gameId: next.id,
        gameTitle: next.title,
        summary:
          `Changed ${next.title} from ${previous.platform} ` +
          `to ${next.platform}.`,
        details: {
          previousPlatform: previous.platform,
          nextPlatform: next.platform,
        },
      });
    }
  }

  recordGameHidden(game: LibraryGame): void {
    this.history.append({
      action: "game_hidden",
      source: this.source,
      gameId: game.id,
      gameTitle: game.title,
      summary: `Hid ${game.title} from the Library.`,
      details: {},
    });
  }

  recordGameUnhidden(game: LibraryGame): void {
    this.history.append({
      action: "game_unhidden",
      source: this.source,
      gameId: game.id,
      gameTitle: game.title,
      summary: `Restored ${game.title} to the Library.`,
      details: {},
    });
  }

  recordGameDeleted(game: LibraryGame): void {
    this.history.append({
      action: "game_deleted",
      source: this.source,
      gameId: game.id,
      gameTitle: game.title,
      summary: `Deleted ${game.title} from the Library.`,
      details: {
        platform: game.platform,
        playStatus: game.playStatus,
      },
    });
  }

  recordLibraryReordered(gameCount: number): void {
    this.history.append({
      action: "library_reordered",
      source: this.source,
      summary: "Changed the manual Library order.",
      details: {
        gameCount,
      },
    });
  }

  recordCollectionCreated(collection: CollectionSummary): void {
    this.history.append({
      action: "collection_created",
      source: this.source,
      collectionId: collection.id,
      collectionName: collection.name,
      summary: `Created the ${collection.name} Collection.`,
      details: {},
    });
  }

  recordCollectionUpdated(
    previous: CollectionSummary,
    next: CollectionSummary,
  ): void {
    if (
      previous.name === next.name &&
      previous.description === next.description
    ) {
      return;
    }

    this.history.append({
      action: "collection_updated",
      source: this.source,
      collectionId: next.id,
      collectionName: next.name,
      summary: `Updated the ${next.name} Collection.`,
      details: {
        previousName: previous.name,
        nextName: next.name,
        descriptionChanged: previous.description !== next.description,
      },
    });
  }

  recordCollectionDeleted(collection: CollectionSummary): void {
    this.history.append({
      action: "collection_deleted",
      source: this.source,
      collectionId: collection.id,
      collectionName: collection.name,
      summary: `Deleted the ${collection.name} Collection.`,
      details: {
        gameCount: collection.gameCount,
      },
    });
  }

  recordPinnedCollectionChanged(
    previous: CollectionSummary | null,
    next: CollectionSummary | null,
  ): void {
    if (previous?.id === next?.id) {
      return;
    }

    if (previous !== null) {
      this.history.append({
        action: "collection_unpinned",
        source: this.source,
        collectionId: previous.id,
        collectionName: previous.name,
        summary: `Unpinned the ${previous.name} Collection.`,
        details: {},
      });
    }

    if (next !== null) {
      this.history.append({
        action: "collection_pinned",
        source: this.source,
        collectionId: next.id,
        collectionName: next.name,
        summary: `Pinned the ${next.name} Collection.`,
        details: {},
      });
    }
  }

  recordCollectionsReordered(collectionCount: number): void {
    this.history.append({
      action: "collection_reordered",
      source: this.source,
      summary: "Changed the Collection order.",
      details: {
        collectionCount,
      },
    });
  }

  recordCollectionGamesReordered(
    collection: CollectionSummary,
    gameCount: number,
  ): void {
    this.history.append({
      action: "collection_games_reordered",
      source: this.source,
      collectionId: collection.id,
      collectionName: collection.name,
      summary: `Changed the game order in ${collection.name}.`,
      details: {
        gameCount,
      },
    });
  }

  recordCollectionMembershipChanged(
    game: LibraryGame,
    collection: CollectionSummary,
    added: boolean,
  ): void {
    this.history.append({
      action: "collection_membership_changed",
      source: this.source,
      gameId: game.id,
      gameTitle: game.title,
      collectionId: collection.id,
      collectionName: collection.name,
      summary: added
        ? `Added ${game.title} to ${collection.name}.`
        : `Removed ${game.title} from ${collection.name}.`,
      details: {
        added,
      },
    });
  }

  recordTrophyAvailabilityChanged(
    input: {
      readonly gameId: string;
      readonly gameTitle: string;
      readonly trophyId: number;
      readonly trophyName: string | null;
      readonly trophyType: PlayStationTrophyType;
      readonly unobtainable: boolean;
      readonly reason: string | null;
    },
    occurredAt?: string,
  ): void {
    const trophyLabel = input.trophyName ?? `Trophy #${input.trophyId}`;

    this.history.append({
      action: input.unobtainable
        ? "trophy_marked_unobtainable"
        : "trophy_restored",
      source: this.source,
      ...(occurredAt === undefined ? {} : { occurredAt }),
      gameId: input.gameId,
      gameTitle: input.gameTitle,
      summary: input.unobtainable
        ? `Marked ${trophyLabel} in ${input.gameTitle} as unobtainable.`
        : `Restored ${trophyLabel} in ${input.gameTitle} to attainable status.`,
      details: {
        trophyId: input.trophyId,
        trophyName: input.trophyName,
        trophyType: input.trophyType,
        reason: input.reason,
      },
    });
  }

  recordBacklogImported(
    counts: BacklogTransferCounts,
    occurredAt?: string,
  ): void {
    this.history.append({
      action: "backlog_imported",
      source: this.source,
      ...(occurredAt === undefined ? {} : { occurredAt }),
      summary: `Imported a portable backlog containing ${counts.libraryGames} games.`,
      details: {
        libraryGames: counts.libraryGames,
        collections: counts.collections,
        savedViews: counts.savedViews,
      },
    });
  }

  recordBacklogDeleted(
    counts: BacklogTransferCounts,
    occurredAt?: string,
  ): void {
    this.history.append({
      action: "backlog_deleted",
      source: this.source,
      ...(occurredAt === undefined ? {} : { occurredAt }),
      summary: `Deleted a backlog containing ${counts.libraryGames} games.`,
      details: {
        libraryGames: counts.libraryGames,
        collections: counts.collections,
        savedViews: counts.savedViews,
      },
    });
  }
}
