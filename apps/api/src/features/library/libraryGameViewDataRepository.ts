import type { DatabaseSync } from "node:sqlite";
import type {
  LibraryGameViewAlert,
  LibraryGameViewData,
} from "./libraryGameTypes.js";

interface GameRow {
  readonly game_id: string;
  readonly has_playstation_link: 0 | 1;
}

interface CollectionMembershipRow {
  readonly game_id: string;
  readonly collection_id: string;
}

interface AlertRow {
  readonly game_id: string;
  readonly kind: LibraryGameViewAlert["kind"];
  readonly status: LibraryGameViewAlert["status"];
  readonly created_at: string;
}

interface MutableLibraryGameViewData {
  readonly collectionIds: string[];
  readonly hasPlayStationLink: boolean;
  readonly alerts: LibraryGameViewAlert[];
}

export class LibraryGameViewDataRepository {
  constructor(private readonly database: DatabaseSync) {}

  findAll(): ReadonlyMap<string, LibraryGameViewData> {
    const gameRows = this.database
      .prepare(
        `
        SELECT
          lg.id AS game_id,
          CASE
            WHEN psl.game_id IS NULL THEN 0
            ELSE 1
          END AS has_playstation_link
        FROM library_games lg
        LEFT JOIN playstation_game_links psl
          ON psl.game_id = lg.id
      `,
      )
      .all() as unknown as GameRow[];

    const viewDataByGameId = new Map<string, MutableLibraryGameViewData>();

    for (const row of gameRows) {
      viewDataByGameId.set(row.game_id, {
        collectionIds: [],
        hasPlayStationLink: row.has_playstation_link === 1,
        alerts: [],
      });
    }

    const membershipRows = this.database
      .prepare(
        `
        SELECT
          game_id,
          collection_id
        FROM collection_games
        ORDER BY game_id ASC, collection_id ASC
      `,
      )
      .all() as unknown as CollectionMembershipRow[];

    for (const row of membershipRows) {
      viewDataByGameId.get(row.game_id)?.collectionIds.push(row.collection_id);
    }

    const alertRows = this.database
      .prepare(
        `
        SELECT
          game_id,
          kind,
          status,
          created_at
        FROM trophy_alerts
        ORDER BY game_id ASC, created_at DESC, id ASC
      `,
      )
      .all() as unknown as AlertRow[];

    for (const row of alertRows) {
      viewDataByGameId.get(row.game_id)?.alerts.push({
        kind: row.kind,
        status: row.status,
        createdAt: row.created_at,
      });
    }

    return viewDataByGameId;
  }
}
