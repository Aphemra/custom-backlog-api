import type { DatabaseSync } from "node:sqlite";
import type { PlayStationPlatform } from "../library/libraryGameTypes.js";
import type {
  CompletionLostAlertDetails,
  NewTrophiesAlertDetails,
  TrophyAlert,
  TrophyAlertCounts,
  TrophyAlertKind,
  TrophyAlertListFilters,
  TrophyAlertStatus,
} from "./trophyAlertTypes.js";

interface TrophyAlertRow {
  id: string;
  game_id: string;
  game_title: string;
  game_platform: PlayStationPlatform;
  kind: TrophyAlertKind;
  status: TrophyAlertStatus;
  previous_snapshot_id: string | null;
  current_snapshot_id: string;
  previous_progress_percent: number | null;
  current_progress_percent: number;
  details_json: string;
  created_at: string;
  resolved_at: string | null;
}

interface TrophyAlertCountRow {
  total: number;
  unread: number;
  unread_new_trophies: number;
  unread_completion_lost: number;
}

const TROPHY_ALERT_SELECT = `
  SELECT
    ta.id,
    ta.game_id,
    lg.title AS game_title,
    lg.platform AS game_platform,
    ta.kind,
    ta.status,
    ta.previous_snapshot_id,
    ta.current_snapshot_id,
    previous.progress_percent AS previous_progress_percent,
    current.progress_percent AS current_progress_percent,
    ta.details_json,
    ta.created_at,
    ta.resolved_at
  FROM trophy_alerts ta
  INNER JOIN library_games lg
    ON lg.id = ta.game_id
  LEFT JOIN trophy_snapshots previous
    ON previous.id = ta.previous_snapshot_id
  INNER JOIN trophy_snapshots current
    ON current.id = ta.current_snapshot_id
`;

function mapAlert(row: TrophyAlertRow): TrophyAlert {
  const common = {
    id: row.id,
    game: {
      id: row.game_id,
      title: row.game_title,
      platform: row.game_platform,
    },
    status: row.status,
    previousSnapshotId: row.previous_snapshot_id,
    currentSnapshotId: row.current_snapshot_id,
    previousProgressPercent: row.previous_progress_percent,
    currentProgressPercent: row.current_progress_percent,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };

  if (row.kind === "new_trophies") {
    const details = JSON.parse(
      row.details_json,
    ) as Partial<NewTrophiesAlertDetails> &
      Omit<NewTrophiesAlertDetails, "trophySetChange">;

    return {
      ...common,
      kind: row.kind,
      details: {
        ...details,
        trophySetChange: details.trophySetChange ?? null,
      },
    };
  }

  const details = JSON.parse(
    row.details_json,
  ) as Partial<CompletionLostAlertDetails> &
    Omit<CompletionLostAlertDetails, "trophySetChange">;

  return {
    ...common,
    kind: row.kind,
    details: {
      ...details,
      trophySetChange: details.trophySetChange ?? null,
    },
  };
}

export class TrophyAlertRepository {
  constructor(private readonly database: DatabaseSync) {}

  list(filters: TrophyAlertListFilters = {}): readonly TrophyAlert[] {
    const conditions: string[] = [];
    const parameters: string[] = [];

    if (filters.kind !== undefined) {
      conditions.push("ta.kind = ?");
      parameters.push(filters.kind);
    }

    if (filters.status !== undefined) {
      conditions.push("ta.status = ?");
      parameters.push(filters.status);
    }

    const where =
      conditions.length === 0 ? "" : `WHERE ${conditions.join(" AND ")}`;

    const rows = this.database
      .prepare(
        `
        ${TROPHY_ALERT_SELECT}
        ${where}
        ORDER BY
          CASE ta.status
            WHEN 'unread' THEN 0
            WHEN 'read' THEN 1
            WHEN 'resolved' THEN 2
            ELSE 3
          END,
          ta.created_at DESC,
          ta.id ASC
      `,
      )
      .all(...parameters) as unknown as TrophyAlertRow[];

    return rows.map(mapAlert);
  }

  findById(alertId: string): TrophyAlert | null {
    const row = this.database
      .prepare(
        `
        ${TROPHY_ALERT_SELECT}
        WHERE ta.id = ?
      `,
      )
      .get(alertId) as unknown as TrophyAlertRow | undefined;

    return row === undefined ? null : mapAlert(row);
  }

  count(): TrophyAlertCounts {
    const row = this.database
      .prepare(
        `
        SELECT
          COUNT(*) AS total,
          COALESCE(SUM(
            CASE WHEN status = 'unread' THEN 1 ELSE 0 END
          ), 0) AS unread,
          COALESCE(SUM(
            CASE
              WHEN status = 'unread' AND kind = 'new_trophies' THEN 1
              ELSE 0
            END
          ), 0) AS unread_new_trophies,
          COALESCE(SUM(
            CASE
              WHEN status = 'unread' AND kind = 'completion_lost' THEN 1
              ELSE 0
            END
          ), 0) AS unread_completion_lost
        FROM trophy_alerts
      `,
      )
      .get() as unknown as TrophyAlertCountRow;

    return {
      total: row.total,
      unread: row.unread,
      unreadNewTrophies: row.unread_new_trophies,
      unreadCompletionLost: row.unread_completion_lost,
    };
  }

  updateStatus(alertId: string, status: TrophyAlertStatus): TrophyAlert | null {
    const current = this.findById(alertId);

    if (current === null) {
      return null;
    }

    const resolvedAt = status === "resolved" ? new Date().toISOString() : null;

    this.database
      .prepare(
        `
        UPDATE trophy_alerts
        SET
          status = ?,
          resolved_at = ?
        WHERE id = ?
      `,
      )
      .run(status, resolvedAt, alertId);

    return this.findById(alertId);
  }
}
