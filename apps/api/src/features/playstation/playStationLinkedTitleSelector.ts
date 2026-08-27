import type { DatabaseSync } from "node:sqlite";
import type {
  LinkedPlayStationTitlePreviewResult,
  PlayStationLibraryCandidate,
  PlayStationTitlePreviewResult,
} from "./playStationTypes.js";

interface LinkedGameRow {
  game_id: string;
  title: string;
  platform: "PS3" | "PS4" | "PS5";
  archived_at: string | null;
  metadata_provider: string | null;
  link_source: "sync_created" | "automatic_match" | "manual_match";
  np_communication_id: string;
  np_service_name: "trophy" | "trophy2";
}

interface LinkedGame {
  candidate: PlayStationLibraryCandidate;
  npCommunicationId: string;
  npServiceName: "trophy" | "trophy2";
}

function createIdentity(
  npServiceName: "trophy" | "trophy2",
  npCommunicationId: string,
): string {
  return `${npServiceName}:${npCommunicationId}`;
}

export class PlayStationLinkedTitleSelector {
  constructor(private readonly database: DatabaseSync) {}

  select(
    preview: PlayStationTitlePreviewResult,
  ): LinkedPlayStationTitlePreviewResult {
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
        FROM playstation_game_links
        INNER JOIN library_games
          ON library_games.id = playstation_game_links.game_id
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
      .all() as unknown as LinkedGameRow[];

    const linkedGames = new Map<string, LinkedGame>(
      rows.map((row) => [
        createIdentity(row.np_service_name, row.np_communication_id),
        {
          candidate: {
            gameId: row.game_id,
            title: row.title,
            platform: row.platform,
            archived: row.archived_at !== null,
            metadataProvider: row.metadata_provider,
            playStationLinkSource: row.link_source,
          },
          npCommunicationId: row.np_communication_id,
          npServiceName: row.np_service_name,
        },
      ]),
    );

    const titles = preview.titles.flatMap((title) => {
      const linkedGame = linkedGames.get(
        createIdentity(title.npServiceName, title.npCommunicationId),
      );

      if (linkedGame === undefined) {
        return [];
      }

      return [
        {
          ...title,
          cachedIcon: null,
          reconciliation: {
            status: "linked" as const,
            candidates: [linkedGame.candidate],
          },
        },
      ];
    });

    return {
      target: preview.target,
      targetTrophySummary: preview.targetTrophySummary,
      providerTitleCount: preview.providerTitleCount,
      supportedTitleCount: preview.supportedTitleCount,
      excludedTitleCount: preview.excludedTitleCount,
      linkedTitleCount: titles.length,
      requestsMade: preview.requestsMade,
      titles,
    };
  }
}
