import type { DatabaseSync } from "node:sqlite";
import { HttpError } from "../../errors/httpError.js";
import type {
  PlayStationTrophyTitlePreview,
  ReconciledPlayStationTitlePreviewResult,
} from "./playStationTypes.js";

interface GameRow {
  id: string;
  platform: "PS3" | "PS4" | "PS5";
}

interface LinkRow {
  game_id: string;
  np_communication_id: string;
  np_service_name: "trophy" | "trophy2";
  psn_title_name: string;
  platforms_json: string;
  icon_url: string | null;
  link_source: "sync_created" | "automatic_match" | "manual_match";
  linked_at: string;
  first_seen_at: string;
  last_seen_at: string;
}

export interface PlayStationGameLink {
  gameId: string;
  npCommunicationId: string;
  npServiceName: "trophy" | "trophy2";
  psnTitleName: string;
  platforms: Array<"PS3" | "PS4" | "PS5">;
  iconUrl: string | null;
  linkSource: "sync_created" | "automatic_match" | "manual_match";
  linkedAt: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

function identity(
  npServiceName: "trophy" | "trophy2",
  npCommunicationId: string,
): string {
  return `${npServiceName}:${npCommunicationId}`;
}

function mapLink(row: LinkRow): PlayStationGameLink {
  return {
    gameId: row.game_id,
    npCommunicationId: row.np_communication_id,
    npServiceName: row.np_service_name,
    psnTitleName: row.psn_title_name,
    platforms: JSON.parse(row.platforms_json) as Array<"PS3" | "PS4" | "PS5">,
    iconUrl: row.icon_url,
    linkSource: row.link_source,
    linkedAt: row.linked_at,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
  };
}

export class PlayStationTitleLinkService {
  private previewTitles = new Map<string, PlayStationTrophyTitlePreview>();

  constructor(private readonly database: DatabaseSync) {}

  rememberPreview(preview: ReconciledPlayStationTitlePreviewResult): void {
    this.previewTitles = new Map(
      preview.titles.map((title) => [
        identity(title.npServiceName, title.npCommunicationId),
        title,
      ]),
    );
  }

  linkTitle(
    gameId: string,
    npServiceName: "trophy" | "trophy2",
    npCommunicationId: string,
  ): PlayStationGameLink {
    const title = this.previewTitles.get(
      identity(npServiceName, npCommunicationId),
    );

    if (title === undefined) {
      throw new HttpError(
        409,
        "playstation_preview_required",
        "Preview PlayStation titles again before linking this trophy stack.",
      );
    }

    const game = this.database
      .prepare(
        `
        SELECT id, platform
        FROM library_games
        WHERE id = ?
      `,
      )
      .get(gameId) as unknown as GameRow | undefined;

    if (game === undefined) {
      throw new HttpError(
        404,
        "game_not_found",
        "The selected library game was not found.",
      );
    }

    if (!title.platforms.includes(game.platform)) {
      throw new HttpError(
        409,
        "playstation_platform_mismatch",
        `${title.name} is not compatible with the selected ${game.platform} library entry.`,
      );
    }

    const gameLink = this.database
      .prepare(
        `
        SELECT
          game_id,
          np_communication_id,
          np_service_name,
          psn_title_name,
          platforms_json,
          icon_url,
          link_source,
          linked_at,
          first_seen_at,
          last_seen_at
        FROM playstation_game_links
        WHERE game_id = ?
      `,
      )
      .get(gameId) as unknown as LinkRow | undefined;

    if (gameLink !== undefined) {
      if (
        gameLink.np_communication_id === npCommunicationId &&
        gameLink.np_service_name === npServiceName
      ) {
        return mapLink(gameLink);
      }

      throw new HttpError(
        409,
        "library_game_already_linked",
        "The selected library game is already linked to another PlayStation trophy stack.",
      );
    }

    const trophyLink = this.database
      .prepare(
        `
        SELECT
          game_id,
          np_communication_id,
          np_service_name,
          psn_title_name,
          platforms_json,
          icon_url,
          link_source,
          linked_at,
          first_seen_at,
          last_seen_at
        FROM playstation_game_links
        WHERE np_communication_id = ?
      `,
      )
      .get(npCommunicationId) as unknown as LinkRow | undefined;

    if (trophyLink !== undefined) {
      throw new HttpError(
        409,
        "playstation_title_already_linked",
        "That PlayStation trophy stack is already linked to another library game.",
      );
    }

    const timestamp = new Date().toISOString();

    this.database
      .prepare(
        `
        INSERT INTO playstation_game_links (
          game_id,
          np_communication_id,
          np_service_name,
          psn_title_name,
          platforms_json,
          icon_url,
          link_source,
          payload_json,
          linked_at,
          first_seen_at,
          last_seen_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        gameId,
        title.npCommunicationId,
        title.npServiceName,
        title.name,
        JSON.stringify(title.platforms),
        title.iconUrl,
        "manual_match",
        JSON.stringify(title),
        timestamp,
        timestamp,
        timestamp,
      );

    return mapLink(
      this.database
        .prepare(
          `
          SELECT
            game_id,
            np_communication_id,
            np_service_name,
            psn_title_name,
            platforms_json,
            icon_url,
            link_source,
            linked_at,
            first_seen_at,
            last_seen_at
          FROM playstation_game_links
          WHERE game_id = ?
        `,
        )
        .get(gameId) as unknown as LinkRow,
    );
  }
}
