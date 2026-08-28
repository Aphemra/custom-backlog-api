import type { DatabaseSync } from "node:sqlite";
import type { IgdbTimeToBeat } from "../igdb/igdbTypes.js";
import { addPortableIgdbDetails } from "./portableIgdbDetails.js";
import type {
  PortableCachedImage,
  PortableDataExportV3,
  PortableExternalGameMetadata,
  PortableGameMetadataLink,
  PortableJsonValue,
  PortableLibraryGameImage,
  PortablePlayStationGameLink,
  PortableTrophyAlert,
  PortableTrophySnapshot,
} from "./portableDataV3Types.js";

type IntegrationData = Pick<
  PortableDataExportV3["data"],
  | "playstationGameLinks"
  | "externalGameMetadata"
  | "gameMetadataLinks"
  | "trophySnapshots"
  | "trophyAlerts"
  | "cachedImages"
  | "libraryGameImages"
>;

interface PlayStationLinkRow {
  game_id: string;
  np_communication_id: string;
  np_service_name: "trophy" | "trophy2";
  psn_title_name: string;
  platforms_json: string;
  icon_url: string | null;
  link_source: "sync_created" | "automatic_match" | "manual_match";
  payload_json: string;
  linked_at: string;
  first_seen_at: string;
  last_seen_at: string;
}

interface ExternalMetadataRow {
  id: string;
  provider: string;
  external_id: string;
  title: string;
  cover_url: string | null;
  release_date: string | null;
  payload_json: string;
  fetched_at: string;
  has_igdb_details: number;
  time_hastily_seconds: number | null;
  time_normally_seconds: number | null;
  time_completely_seconds: number | null;
  time_submission_count: number | null;
}

interface MetadataLinkRow {
  game_id: string;
  metadata_id: string;
  linked_at: string;
}

interface TrophySnapshotRow {
  id: string;
  game_id: string;
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
  has_platinum: number;
  payload_json: string | null;
}

interface TrophyAlertRow {
  id: string;
  game_id: string;
  kind: "new_trophies" | "completion_lost";
  status: "unread" | "read" | "resolved" | "dismissed";
  previous_snapshot_id: string | null;
  current_snapshot_id: string;
  details_json: string;
  created_at: string;
  resolved_at: string | null;
}

interface CachedImageRow {
  id: string;
  provider: "igdb" | "playstation";
  source_key: string;
  source_url: string;
  created_at: string;
  updated_at: string;
}

interface LibraryGameImageRow {
  game_id: string;
  image_id: string;
  role: "cover" | "icon" | "background";
  sort_order: number;
  linked_at: string;
}

function normalizeTimestamp(value: string): string {
  const date = new Date(
    value.includes("T") ? value : `${value.replace(" ", "T")}Z`,
  );

  if (Number.isNaN(date.valueOf())) {
    throw new Error(`Database contains an invalid timestamp: ${value}`);
  }

  return date.toISOString();
}

function readJson(value: string): PortableJsonValue {
  return JSON.parse(value) as PortableJsonValue;
}

function readMetadataPayload(row: ExternalMetadataRow): PortableJsonValue {
  const payload = readJson(row.payload_json);

  if (row.has_igdb_details !== 1) {
    return payload;
  }

  const submissionCount = row.time_submission_count ?? 0;

  const timeToBeat: IgdbTimeToBeat | null =
    row.time_hastily_seconds === null &&
    row.time_normally_seconds === null &&
    row.time_completely_seconds === null &&
    submissionCount === 0
      ? null
      : {
          hastilySeconds: row.time_hastily_seconds,
          normallySeconds: row.time_normally_seconds,
          completelySeconds: row.time_completely_seconds,
          submissionCount,
        };

  return addPortableIgdbDetails(payload, timeToBeat);
}

export function readPortableV3IntegrationData(
  database: DatabaseSync,
): IntegrationData {
  const playstationRows = database
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
          payload_json,
          linked_at,
          first_seen_at,
          last_seen_at
        FROM playstation_game_links
        ORDER BY game_id ASC
      `,
    )
    .all() as unknown as PlayStationLinkRow[];

  const metadataRows = database
    .prepare(
      `
        SELECT
          external_game_metadata.id,
          external_game_metadata.provider,
          external_game_metadata.external_id,
          external_game_metadata.title,
          external_game_metadata.cover_url,
          external_game_metadata.release_date,
          external_game_metadata.payload_json,
          external_game_metadata.fetched_at,
          CASE
            WHEN igdb_game_details.metadata_id IS NULL THEN 0
            ELSE 1
          END AS has_igdb_details,
          igdb_game_details.time_hastily_seconds,
          igdb_game_details.time_normally_seconds,
          igdb_game_details.time_completely_seconds,
          igdb_game_details.time_submission_count
        FROM external_game_metadata
        LEFT JOIN igdb_game_details
          ON igdb_game_details.metadata_id = external_game_metadata.id
        ORDER BY
          external_game_metadata.provider ASC,
          external_game_metadata.external_id ASC
      `,
    )
    .all() as unknown as ExternalMetadataRow[];

  const metadataLinkRows = database
    .prepare(
      `
        SELECT game_id, metadata_id, linked_at
        FROM game_metadata_links
        ORDER BY game_id ASC
      `,
    )
    .all() as unknown as MetadataLinkRow[];

  const snapshotRows = database
    .prepare(
      `
        SELECT
          id,
          game_id,
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
        FROM trophy_snapshots
        ORDER BY game_id ASC, captured_at ASC
      `,
    )
    .all() as unknown as TrophySnapshotRow[];

  const alertRows = database
    .prepare(
      `
        SELECT
          id,
          game_id,
          kind,
          status,
          previous_snapshot_id,
          current_snapshot_id,
          details_json,
          created_at,
          resolved_at
        FROM trophy_alerts
        ORDER BY created_at ASC, id ASC
      `,
    )
    .all() as unknown as TrophyAlertRow[];

  const cachedImageRows = database
    .prepare(
      `
        SELECT
          id,
          provider,
          source_key,
          source_url,
          created_at,
          updated_at
        FROM cached_images
        ORDER BY provider ASC, source_key ASC
      `,
    )
    .all() as unknown as CachedImageRow[];

  const gameImageRows = database
    .prepare(
      `
        SELECT
          game_id,
          image_id,
          role,
          sort_order,
          linked_at
        FROM library_game_images
        ORDER BY game_id ASC, role ASC, sort_order ASC
      `,
    )
    .all() as unknown as LibraryGameImageRow[];

  const playstationGameLinks: readonly PortablePlayStationGameLink[] =
    playstationRows.map((row) => ({
      gameId: row.game_id,
      npCommunicationId: row.np_communication_id,
      npServiceName: row.np_service_name,
      psnTitleName: row.psn_title_name,

      platforms: JSON.parse(
        row.platforms_json,
      ) as PortablePlayStationGameLink["platforms"],

      iconUrl: row.icon_url,
      linkSource: row.link_source,
      payload: readJson(row.payload_json),
      linkedAt: normalizeTimestamp(row.linked_at),
      firstSeenAt: normalizeTimestamp(row.first_seen_at),
      lastSeenAt: normalizeTimestamp(row.last_seen_at),
    }));

  const externalGameMetadata: readonly PortableExternalGameMetadata[] =
    metadataRows.map((row) => ({
      id: row.id,
      provider: row.provider,
      externalId: row.external_id,
      title: row.title,
      coverUrl: row.cover_url,
      releaseDate: row.release_date,
      payload: readMetadataPayload(row),
      fetchedAt: normalizeTimestamp(row.fetched_at),
    }));

  const gameMetadataLinks: readonly PortableGameMetadataLink[] =
    metadataLinkRows.map((row) => ({
      gameId: row.game_id,
      metadataId: row.metadata_id,
      linkedAt: normalizeTimestamp(row.linked_at),
    }));

  const trophySnapshots: readonly PortableTrophySnapshot[] = snapshotRows.map(
    (row) => ({
      id: row.id,
      gameId: row.game_id,
      capturedAt: normalizeTimestamp(row.captured_at),
      bronzeTotal: row.bronze_total,
      silverTotal: row.silver_total,
      goldTotal: row.gold_total,
      platinumTotal: row.platinum_total,
      bronzeEarned: row.bronze_earned,
      silverEarned: row.silver_earned,
      goldEarned: row.gold_earned,
      platinumEarned: row.platinum_earned,
      progressPercent: row.progress_percent,
      is100Percent: row.is_100_percent === 1,
      hasPlatinum: row.has_platinum === 1,

      payload: row.payload_json === null ? null : readJson(row.payload_json),
    }),
  );

  const trophyAlerts: readonly PortableTrophyAlert[] = alertRows.map((row) => ({
    id: row.id,
    gameId: row.game_id,
    kind: row.kind,
    status: row.status,
    previousSnapshotId: row.previous_snapshot_id,
    currentSnapshotId: row.current_snapshot_id,
    details: readJson(row.details_json),
    createdAt: normalizeTimestamp(row.created_at),

    resolvedAt:
      row.resolved_at === null ? null : normalizeTimestamp(row.resolved_at),
  }));

  const cachedImages: readonly PortableCachedImage[] = cachedImageRows.map(
    (row) => ({
      id: row.id,
      provider: row.provider,
      sourceKey: row.source_key,
      sourceUrl: row.source_url,
      createdAt: normalizeTimestamp(row.created_at),
      updatedAt: normalizeTimestamp(row.updated_at),
    }),
  );

  const libraryGameImages: readonly PortableLibraryGameImage[] =
    gameImageRows.map((row) => ({
      gameId: row.game_id,
      imageId: row.image_id,
      role: row.role,
      sortOrder: row.sort_order,
      linkedAt: normalizeTimestamp(row.linked_at),
    }));

  return {
    playstationGameLinks,
    externalGameMetadata,
    gameMetadataLinks,
    trophySnapshots,
    trophyAlerts,
    cachedImages,
    libraryGameImages,
  };
}

export function deletePortableV3IntegrationData(database: DatabaseSync): void {
  database.exec(`
    DELETE FROM trophy_alerts;
    DELETE FROM trophy_snapshots;
    DELETE FROM trophy_sync_runs;
    DELETE FROM library_game_images;
    DELETE FROM cached_images;
    DELETE FROM game_metadata_links;
    DELETE FROM external_game_metadata;
    DELETE FROM playstation_game_links;
  `);
}

export function insertPortableV3IntegrationData(
  database: DatabaseSync,
  data: IntegrationData,
): void {
  const insertPlayStationLink = database.prepare(`
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
  `);

  const insertMetadata = database.prepare(`
    INSERT INTO external_game_metadata (
      id,
      provider,
      external_id,
      title,
      cover_url,
      release_date,
      payload_json,
      fetched_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMetadataLink = database.prepare(`
    INSERT INTO game_metadata_links (
      game_id,
      metadata_id,
      linked_at
    ) VALUES (?, ?, ?)
  `);

  const insertSnapshot = database.prepare(`
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
    ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAlert = database.prepare(`
    INSERT INTO trophy_alerts (
      id,
      game_id,
      kind,
      status,
      previous_snapshot_id,
      current_snapshot_id,
      details_json,
      created_at,
      resolved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertCachedImage = database.prepare(`
    INSERT INTO cached_images (
      id,
      provider,
      source_key,
      source_url,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertGameImage = database.prepare(`
    INSERT INTO library_game_images (
      game_id,
      image_id,
      role,
      sort_order,
      linked_at
    ) VALUES (?, ?, ?, ?, ?)
  `);

  for (const link of data.playstationGameLinks) {
    insertPlayStationLink.run(
      link.gameId,
      link.npCommunicationId,
      link.npServiceName,
      link.psnTitleName,
      JSON.stringify(link.platforms),
      link.iconUrl,
      link.linkSource,
      JSON.stringify(link.payload),
      link.linkedAt,
      link.firstSeenAt,
      link.lastSeenAt,
    );
  }

  for (const metadata of data.externalGameMetadata) {
    insertMetadata.run(
      metadata.id,
      metadata.provider,
      metadata.externalId,
      metadata.title,
      metadata.coverUrl,
      metadata.releaseDate,
      JSON.stringify(metadata.payload),
      metadata.fetchedAt,
    );
  }

  for (const link of data.gameMetadataLinks) {
    insertMetadataLink.run(link.gameId, link.metadataId, link.linkedAt);
  }

  for (const snapshot of data.trophySnapshots) {
    insertSnapshot.run(
      snapshot.id,
      snapshot.gameId,
      snapshot.capturedAt,
      snapshot.bronzeTotal,
      snapshot.silverTotal,
      snapshot.goldTotal,
      snapshot.platinumTotal,
      snapshot.bronzeEarned,
      snapshot.silverEarned,
      snapshot.goldEarned,
      snapshot.platinumEarned,
      snapshot.progressPercent,
      snapshot.is100Percent ? 1 : 0,
      snapshot.hasPlatinum ? 1 : 0,

      snapshot.payload === null ? null : JSON.stringify(snapshot.payload),
    );
  }

  for (const alert of data.trophyAlerts) {
    insertAlert.run(
      alert.id,
      alert.gameId,
      alert.kind,
      alert.status,
      alert.previousSnapshotId,
      alert.currentSnapshotId,
      JSON.stringify(alert.details),
      alert.createdAt,
      alert.resolvedAt,
    );
  }

  for (const image of data.cachedImages) {
    insertCachedImage.run(
      image.id,
      image.provider,
      image.sourceKey,
      image.sourceUrl,
      image.createdAt,
      image.updatedAt,
    );
  }

  for (const image of data.libraryGameImages) {
    insertGameImage.run(
      image.gameId,
      image.imageId,
      image.role,
      image.sortOrder,
      image.linkedAt,
    );
  }
}
