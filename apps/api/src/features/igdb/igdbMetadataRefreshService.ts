import type { DatabaseSync } from "node:sqlite";
import { HttpError } from "../../errors/httpError.js";

interface LinkedIgdbGameRow {
  game_id: string;
  title: string;
}

interface IgdbGameMetadataRefresher {
  refreshExistingGame(gameId: string): Promise<unknown>;
}

export interface IgdbMetadataRefreshFailure {
  gameId: string;
  title: string;
  message: string;
}

export interface IgdbMetadataRefreshResult {
  expectedGameCount: number;
  refreshedGameCount: number;
  failedGameCount: number;
  skippedGameCount: number;
  stoppedEarly: boolean;
  failures: readonly IgdbMetadataRefreshFailure[];
}

export interface IgdbMetadataRefreshProgress {
  completedItems: number;
  totalItems: number;
  currentItem: string | null;
  message: string;
}

export type IgdbMetadataRefreshProgressReporter = (
  progress: IgdbMetadataRefreshProgress,
) => void;

export class IgdbMetadataRefreshService {
  constructor(
    private readonly database: DatabaseSync,
    private readonly refresher: IgdbGameMetadataRefresher,
  ) {}

  async refreshAll(
    reportProgress?: IgdbMetadataRefreshProgressReporter,
  ): Promise<IgdbMetadataRefreshResult> {
    const games = this.database
      .prepare(
        `
        SELECT
          library_games.id AS game_id,
          library_games.title
        FROM library_games
        INNER JOIN game_metadata_links
          ON game_metadata_links.game_id = library_games.id
        INNER JOIN external_game_metadata
          ON external_game_metadata.id = game_metadata_links.metadata_id
        WHERE external_game_metadata.provider = 'igdb'
        ORDER BY
          library_games.priority_rank ASC,
          library_games.sort_title ASC,
          library_games.id ASC
      `,
      )
      .all() as unknown as LinkedIgdbGameRow[];

    const failures: IgdbMetadataRefreshFailure[] = [];
    let refreshedGameCount = 0;
    let attemptedGameCount = 0;
    let stoppedEarly = false;

    reportProgress?.({
      completedItems: 0,
      totalItems: games.length,
      currentItem: games[0]?.title ?? null,
      message:
        games.length === 0
          ? "No linked IGDB metadata requires refreshing."
          : "Refreshing linked IGDB metadata.",
    });

    for (const game of games) {
      reportProgress?.({
        completedItems: attemptedGameCount,
        totalItems: games.length,
        currentItem: game.title,
        message: "Requesting current metadata from IGDB.",
      });

      try {
        await this.refresher.refreshExistingGame(game.game_id);
        refreshedGameCount += 1;
      } catch (error) {
        if (!(error instanceof HttpError)) {
          throw error;
        }

        failures.push({
          gameId: game.game_id,
          title: game.title,
          message: error.message,
        });

        if (error.statusCode >= 500) {
          stoppedEarly = true;
        }
      }

      attemptedGameCount += 1;

      reportProgress?.({
        completedItems: attemptedGameCount,
        totalItems: games.length,
        currentItem: game.title,
        message: stoppedEarly
          ? "IGDB became unavailable, so remaining metadata was preserved."
          : "Finished processing this IGDB game.",
      });

      if (stoppedEarly) {
        break;
      }
    }

    return {
      expectedGameCount: games.length,
      refreshedGameCount,
      failedGameCount: failures.length,
      skippedGameCount: games.length - refreshedGameCount - failures.length,
      stoppedEarly,
      failures,
    };
  }
}
