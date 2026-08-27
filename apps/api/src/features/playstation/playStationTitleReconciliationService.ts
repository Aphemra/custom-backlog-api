import type { DatabaseSync } from "node:sqlite";
import type {
  PlayStationLibraryCandidate,
  PlayStationReconciliationCounts,
  PlayStationTitlePreviewResult,
  PlayStationTitleReconciliation,
  PlayStationTrophyTitlePreview,
  ReconciledPlayStationTitlePreviewResult,
} from "./playStationTypes.js";

interface ReconciliationRow {
  game_id: string;
  title: string;
  platform: "PS3" | "PS4" | "PS5";
  archived_at: string | null;
  metadata_provider: string | null;
  link_source: "sync_created" | "automatic_match" | "manual_match" | null;
  np_communication_id: string | null;
  np_service_name: "trophy" | "trophy2" | null;
}

interface ReconciliationGame {
  candidate: PlayStationLibraryCandidate;
  normalizedTitle: string;
  npCommunicationId: string | null;
  npServiceName: "trophy" | "trophy2" | null;
}

function normalizeTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/&/g, " and ")
    .replace(/[™®©]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-US");
}

function createIdentity(
  npServiceName: "trophy" | "trophy2",
  npCommunicationId: string,
): string {
  return `${npServiceName}:${npCommunicationId}`;
}

function createMatch(
  title: PlayStationTrophyTitlePreview,
  games: readonly ReconciliationGame[],
  linkedGames: ReadonlyMap<string, ReconciliationGame>,
): PlayStationTitleReconciliation {
  const linkedGame = linkedGames.get(
    createIdentity(title.npServiceName, title.npCommunicationId),
  );

  if (linkedGame !== undefined) {
    return {
      status: "linked",
      candidates: [linkedGame.candidate],
    };
  }

  const normalizedTitle = normalizeTitle(title.name);

  const candidates = games
    .filter(
      (game) =>
        game.normalizedTitle === normalizedTitle &&
        title.platforms.includes(game.candidate.platform),
    )
    .map((game) => game.candidate);

  if (candidates.length === 1) {
    return {
      status: "suggested_match",
      candidates,
    };
  }

  if (candidates.length > 1) {
    return {
      status: "ambiguous",
      candidates,
    };
  }

  return {
    status: "new",
    candidates: [],
  };
}

export class PlayStationTitleReconciliationService {
  constructor(private readonly database: DatabaseSync) {}

  reconcile(
    preview: PlayStationTitlePreviewResult,
  ): ReconciledPlayStationTitlePreviewResult {
    const rows = this.database
      .prepare(
        `
        SELECT
          library_games.id AS game_id,
          library_games.title,
          library_games.platform,
          library_games.archived_at,
          external_game_metadata.provider AS metadata_provider,
          playstation_game_links.link_source,
          playstation_game_links.np_communication_id,
          playstation_game_links.np_service_name
        FROM library_games
        LEFT JOIN playstation_game_links
          ON playstation_game_links.game_id = library_games.id
        LEFT JOIN game_metadata_links
          ON game_metadata_links.game_id = library_games.id
        LEFT JOIN external_game_metadata
          ON external_game_metadata.id = game_metadata_links.metadata_id
        ORDER BY
          library_games.archived_at IS NOT NULL,
          library_games.priority_rank,
          library_games.sort_title
      `,
      )
      .all() as unknown as ReconciliationRow[];

    const games: ReconciliationGame[] = rows.map((row) => ({
      candidate: {
        gameId: row.game_id,
        title: row.title,
        platform: row.platform,
        archived: row.archived_at !== null,
        metadataProvider: row.metadata_provider,
        playStationLinkSource: row.link_source,
      },
      normalizedTitle: normalizeTitle(row.title),
      npCommunicationId: row.np_communication_id,
      npServiceName: row.np_service_name,
    }));

    const linkedGames = new Map<string, ReconciliationGame>();

    for (const game of games) {
      if (game.npCommunicationId !== null && game.npServiceName !== null) {
        linkedGames.set(
          createIdentity(game.npServiceName, game.npCommunicationId),
          game,
        );
      }
    }

    const reconciliationCounts: PlayStationReconciliationCounts = {
      linked: 0,
      suggestedMatch: 0,
      ambiguous: 0,
      new: 0,
    };

    const titles = preview.titles.map((title) => {
      const reconciliation = createMatch(title, games, linkedGames);

      switch (reconciliation.status) {
        case "linked":
          reconciliationCounts.linked += 1;
          break;

        case "suggested_match":
          reconciliationCounts.suggestedMatch += 1;
          break;

        case "ambiguous":
          reconciliationCounts.ambiguous += 1;
          break;

        case "new":
          reconciliationCounts.new += 1;
          break;
      }

      return {
        ...title,
        cachedIcon: null,
        reconciliation,
      };
    });

    return {
      ...preview,
      titles,
      reconciliationCounts,
    };
  }
}
