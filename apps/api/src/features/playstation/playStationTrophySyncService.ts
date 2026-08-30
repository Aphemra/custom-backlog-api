import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { BacklogActivityRecorder } from "../history/backlogActivityRecorder.js";
import type { PlayStatus } from "../library/libraryGameTypes.js";
import type {
  PlayStationSyncResult,
  PlayStationTrophyCounts,
  PlayStationTrophySyncPreview,
  ReconciledPlayStationTitle,
} from "./playStationTypes.js";
import { PlayStationTrophySetChangeService } from "./playStationTrophySetChangeService.js";

interface CountRow {
  count: number;
}

interface PreviousSnapshotRow {
  id: string;
  captured_at: string;
  bronze_total: number;
  silver_total: number;
  gold_total: number;
  platinum_total: number;
  bronze_earned: number;
  silver_earned: number;
  gold_earned: number;
  platinum_earned: number;
  progress_percent: number;
  is_100_percent: number;
}

interface GameStatusHistoryRow {
  title: string;
  play_status: PlayStatus;
}

type Clock = () => Date;

function countTrophies(counts: PlayStationTrophyCounts): number {
  return counts.bronze + counts.silver + counts.gold + counts.platinum;
}

function trophySetIncreased(
  previous: PreviousSnapshotRow,
  title: ReconciledPlayStationTitle,
): boolean {
  return (
    title.definedTrophies.bronze > previous.bronze_total ||
    title.definedTrophies.silver > previous.silver_total ||
    title.definedTrophies.gold > previous.gold_total ||
    title.definedTrophies.platinum > previous.platinum_total
  );
}

function readPreviousCounts(
  previous: PreviousSnapshotRow,
): PlayStationTrophyCounts {
  return {
    bronze: previous.bronze_total,
    silver: previous.silver_total,
    gold: previous.gold_total,
    platinum: previous.platinum_total,
  };
}

export class PlayStationTrophySyncService {
  private readonly trophySetChangeService: PlayStationTrophySetChangeService;
  private readonly activity: BacklogActivityRecorder;

  constructor(
    private readonly database: DatabaseSync,
    private readonly clock: Clock = () => new Date(),
  ) {
    this.trophySetChangeService = new PlayStationTrophySetChangeService(
      database,
    );

    this.activity = new BacklogActivityRecorder(database, "playstation_sync");
  }

  synchronize(preview: PlayStationTrophySyncPreview): PlayStationSyncResult {
    const syncRunId = randomUUID();
    const profileSnapshotId = randomUUID();
    const startedAt = this.clock().toISOString();

    const expectedTitleCount = (
      this.database
        .prepare(
          `
          SELECT COUNT(*) AS count
          FROM playstation_game_links
        `,
        )
        .get() as unknown as CountRow
    ).count;

    const linkedTitles = preview.titles.flatMap((title) => {
      if (title.reconciliation.status !== "linked") {
        return [];
      }

      const candidate = title.reconciliation.candidates[0];

      return candidate === undefined
        ? []
        : [{ title, gameId: candidate.gameId }];
    });

    let processedTitleCount = 0;
    let snapshotsCreated = 0;
    let newTrophyAlertsCreated = 0;
    let completionLostAlertsCreated = 0;

    this.database.exec("BEGIN IMMEDIATE");

    try {
      this.database
        .prepare(
          `
          INSERT INTO trophy_sync_runs (
            id,
            target_account_id,
            reader_account_id,
            status,
            request_count,
            expected_title_count,
            processed_title_count,
            started_at
          ) VALUES (?, ?, NULL, 'running', ?, ?, 0, ?)
        `,
        )
        .run(
          syncRunId,
          preview.target.accountId,
          preview.requestsMade,
          expectedTitleCount,
          startedAt,
        );

      this.database
        .prepare(
          `
          INSERT INTO playstation_profile_snapshots (
            id,
            sync_run_id,
            account_id,
            captured_at,
            trophy_level,
            level_progress_percent,
            tier,
            bronze_earned,
            silver_earned,
            gold_earned,
            platinum_earned,
            payload_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        )
        .run(
          profileSnapshotId,
          syncRunId,
          preview.target.accountId,
          startedAt,
          preview.targetTrophySummary.trophyLevel,
          preview.targetTrophySummary.progress,
          preview.targetTrophySummary.tier,
          preview.targetTrophySummary.earnedTrophies.bronze,
          preview.targetTrophySummary.earnedTrophies.silver,
          preview.targetTrophySummary.earnedTrophies.gold,
          preview.targetTrophySummary.earnedTrophies.platinum,
          JSON.stringify(preview.targetTrophySummary),
        );

      for (const { title, gameId } of linkedTitles) {
        const storedLink = this.database
          .prepare(
            `
            SELECT game_id
            FROM playstation_game_links
            WHERE
              game_id = ?
              AND np_communication_id = ?
              AND np_service_name = ?
          `,
          )
          .get(gameId, title.npCommunicationId, title.npServiceName);

        if (storedLink === undefined) {
          continue;
        }

        const previous = this.database
          .prepare(
            `
            SELECT
              id,
              captured_at,
              bronze_total,
              silver_total,
              gold_total,
              platinum_total,
              bronze_earned,
              silver_earned,
              gold_earned,
              platinum_earned,
              progress_percent,
              is_100_percent
            FROM trophy_snapshots
            WHERE game_id = ?
            ORDER BY captured_at DESC
            LIMIT 1
          `,
          )
          .get(gameId) as unknown as PreviousSnapshotRow | undefined;

        let capturedAt = startedAt;

        if (previous?.captured_at === capturedAt) {
          capturedAt = new Date(Date.parse(capturedAt) + 1).toISOString();
        }

        const snapshotId = randomUUID();
        const is100Percent = title.progress === 100;
        const hasPlatinum = title.definedTrophies.platinum > 0;

        this.database
          .prepare(
            `
            INSERT INTO trophy_snapshots (
              id,
              game_id,
              sync_run_id,
              captured_at,
              bronze_total,
              silver_total,
              gold_total,
              platinum_total,
              bronze_earned,
              silver_earned,
              gold_earned,
              platinum_earned,
              progress_percent,
              is_100_percent,
              has_platinum,
              payload_json
            ) VALUES (
              ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?, ?
            )
          `,
          )
          .run(
            snapshotId,
            gameId,
            syncRunId,
            capturedAt,
            title.definedTrophies.bronze,
            title.definedTrophies.silver,
            title.definedTrophies.gold,
            title.definedTrophies.platinum,
            title.earnedTrophies.bronze,
            title.earnedTrophies.silver,
            title.earnedTrophies.gold,
            title.earnedTrophies.platinum,
            title.progress,
            is100Percent ? 1 : 0,
            hasPlatinum ? 1 : 0,
            JSON.stringify(title),
          );

        snapshotsCreated += 1;
        processedTitleCount += 1;

        this.database
          .prepare(
            `
            UPDATE playstation_game_links
            SET
              psn_title_name = ?,
              platforms_json = ?,
              icon_url = ?,
              payload_json = ?,
              last_seen_at = ?
            WHERE game_id = ?
          `,
          )
          .run(
            title.name,
            JSON.stringify(title.platforms),
            title.iconUrl,
            JSON.stringify(title),
            capturedAt,
            gameId,
          );

        const trophySetChange =
          previous !== undefined && trophySetIncreased(previous, title)
            ? this.trophySetChangeService.describe(
                gameId,
                readPreviousCounts(previous),
                title.definedTrophies,
              )
            : null;

        if (previous !== undefined && trophySetChange !== null) {
          this.database
            .prepare(
              `
              INSERT INTO trophy_alerts (
                id,
                game_id,
                kind,
                status,
                previous_snapshot_id,
                current_snapshot_id,
                details_json,
                created_at
              ) VALUES (?, ?, 'new_trophies', 'unread', ?, ?, ?, ?)
            `,
            )
            .run(
              randomUUID(),
              gameId,
              previous.id,
              snapshotId,
              JSON.stringify({
                title: title.name,
                previousTotals: readPreviousCounts(previous),
                currentTotals: title.definedTrophies,
                previousTotalCount:
                  previous.bronze_total +
                  previous.silver_total +
                  previous.gold_total +
                  previous.platinum_total,
                currentTotalCount: countTrophies(title.definedTrophies),
                trophySetChange,
              }),
              capturedAt,
            );

          newTrophyAlertsCreated += 1;
        }

        if (
          previous !== undefined &&
          previous.is_100_percent === 1 &&
          !is100Percent
        ) {
          this.database
            .prepare(
              `
              INSERT INTO trophy_alerts (
                id,
                game_id,
                kind,
                status,
                previous_snapshot_id,
                current_snapshot_id,
                details_json,
                created_at
              ) VALUES (
                ?, ?, 'completion_lost', 'unread', ?, ?, ?, ?
              )
            `,
            )
            .run(
              randomUUID(),
              gameId,
              previous.id,
              snapshotId,
              JSON.stringify({
                title: title.name,
                previousProgress: previous.progress_percent,
                currentProgress: title.progress,
                previousEarned: {
                  bronze: previous.bronze_earned,
                  silver: previous.silver_earned,
                  gold: previous.gold_earned,
                  platinum: previous.platinum_earned,
                },
                currentEarned: title.earnedTrophies,
                trophySetChange,
              }),
              capturedAt,
            );

          completionLostAlertsCreated += 1;
        }

        if (is100Percent) {
          const previousGameStatus = this.database
            .prepare(
              `
                SELECT title, play_status
                FROM library_games
                WHERE id = ?
              `,
            )
            .get(gameId) as unknown as GameStatusHistoryRow | undefined;

          const completionUpdate = this.database
            .prepare(
              `
              UPDATE library_games
              SET
                play_status = 'completed',
                pursuit_status = 'finished',
                updated_at = ?
              WHERE
                id = ?
                AND play_status <> 'completed'
            `,
            )
            .run(capturedAt, gameId);

          if (
            completionUpdate.changes === 1 &&
            previousGameStatus !== undefined
          ) {
            this.activity.recordPlayStatusChanged(
              gameId,
              previousGameStatus.title,
              previousGameStatus.play_status,
              "completed",
              capturedAt,
            );
          }

          this.database
            .prepare(
              `
              UPDATE trophy_alerts
              SET
                status = 'resolved',
                resolved_at = ?
              WHERE
                game_id = ?
                AND kind = 'completion_lost'
                AND status IN ('unread', 'read')
            `,
            )
            .run(capturedAt, gameId);
        }
      }

      const status =
        processedTitleCount === expectedTitleCount ? "succeeded" : "partial";

      const finishedAt = this.clock().toISOString();

      this.database
        .prepare(
          `
          UPDATE trophy_sync_runs
          SET
            status = ?,
            processed_title_count = ?,
            finished_at = ?
          WHERE id = ?
        `,
        )
        .run(status, processedTitleCount, finishedAt, syncRunId);

      this.database.exec("COMMIT");

      return {
        syncRunId,
        status,
        targetAccountId: preview.target.accountId,
        expectedTitleCount,
        processedTitleCount,
        snapshotsCreated,
        newTrophyAlertsCreated,
        completionLostAlertsCreated,
        profileSnapshot: {
          id: profileSnapshotId,
          syncRunId,
          accountId: preview.target.accountId,
          capturedAt: startedAt,
          trophyLevel: preview.targetTrophySummary.trophyLevel,
          levelProgressPercent: preview.targetTrophySummary.progress,
          tier: preview.targetTrophySummary.tier,
          earnedTrophies: {
            ...preview.targetTrophySummary.earnedTrophies,
          },
        },
        requestsMade: preview.requestsMade,
        startedAt,
        finishedAt,
      };
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}
