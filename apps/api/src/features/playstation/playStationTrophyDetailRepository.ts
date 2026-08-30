import type { DatabaseSync } from "node:sqlite";
import { HttpError } from "../../errors/httpError.js";
import { BacklogActivityRecorder } from "../history/backlogActivityRecorder.js";
import type {
  PlayStationTrophyCounts,
  PlayStationTrophyDefinition,
  PlayStationTrophyDetailFetchResult,
  PlayStationTrophyEarning,
  PlayStationTrophyEarningsFetchResult,
  PlayStationTrophyPlatform,
  PlayStationTrophyRarity,
  PlayStationTrophyTitlePreview,
  PlayStationTrophyType,
} from "./playStationTypes.js";

type Clock = () => Date;

interface LinkRow {
  np_communication_id: string;
  np_service_name: "trophy" | "trophy2";
}

interface TrophyAvailabilityHistoryRow {
  trophy_id: number;
  trophy_type: PlayStationTrophyType;
  name: string | null;
  game_title: string;
  was_unobtainable: number;
  previous_reason: string | null;
}

interface StoredTrophySetRow {
  game_id: string;
  np_communication_id: string;
  np_service_name: "trophy" | "trophy2";
  trophy_set_version: string;
  title_name: string;
  title_detail: string | null;
  platforms_json: string;
  icon_url: string;
  icon_image_id: string | null;
  has_trophy_groups: number;
  bronze_total: number;
  silver_total: number;
  gold_total: number;
  platinum_total: number;
  last_observed_title_updated_at: string | null;
  definitions_refreshed_at: string;
  earnings_refreshed_at: string | null;
  earnings_account_id: string | null;
  definition_payload_json: string;
  earnings_payload_json: string | null;
  created_at: string;
  updated_at: string;
}

interface StoredGroupRow {
  game_id: string;
  trophy_group_id: string;
  name: string;
  detail: string | null;
  icon_url: string;
  icon_image_id: string | null;
  bronze_total: number;
  silver_total: number;
  gold_total: number;
  platinum_total: number;
  payload_json: string;
}

interface StoredTrophyRow {
  game_id: string;
  trophy_id: number;
  trophy_group_id: string;
  trophy_type: PlayStationTrophyType;
  name: string | null;
  detail: string | null;
  icon_url: string | null;
  icon_image_id: string | null;
  is_secret: number;
  is_earned: number;
  earned_at: string | null;
  rarity: number | null;
  earned_rate: number | null;
  progress_target_value: string | null;
  progress_value: string | null;
  progress_rate: number | null;
  reward_name: string | null;
  reward_image_url: string | null;
  definition_payload_json: string;
  earnings_payload_json: string | null;
  is_unobtainable: number;
  unobtainable_reason: string | null;
  availability_updated_at: string | null;
}

interface ExistingTrophyIdentityRow {
  trophy_id: number;
  trophy_type: PlayStationTrophyType;
}

export interface StoredPlayStationTrophy {
  trophyId: number;
  trophyGroupId: string;
  trophyType: PlayStationTrophyType;
  name: string | null;
  detail: string | null;
  iconUrl: string | null;
  iconImageId: string | null;
  secret: boolean;
  earned: boolean;
  earnedAt: string | null;
  rarity: PlayStationTrophyRarity | null;
  earnedRate: number | null;
  progressTargetValue: string | null;
  progressValue: string | null;
  progressRate: number | null;
  rewardName: string | null;
  rewardImageUrl: string | null;
  definitionProviderPayload: unknown;
  earningsProviderPayload: unknown | null;
  unobtainable: boolean;
  unobtainableReason: string | null;
  availabilityUpdatedAt: string | null;
}

export interface UpdatePlayStationTrophyAvailabilityInput {
  unobtainable: boolean;
  reason: string | null;
}

export interface StoredPlayStationTrophyGroup {
  trophyGroupId: string;
  name: string;
  detail: string | null;
  iconUrl: string;
  iconImageId: string | null;
  definedTrophies: PlayStationTrophyCounts;
  providerPayload: unknown;
  trophies: StoredPlayStationTrophy[];
}

export interface StoredPlayStationTrophySet {
  gameId: string;
  npCommunicationId: string;
  npServiceName: "trophy" | "trophy2";
  trophySetVersion: string;
  titleName: string;
  titleDetail: string | null;
  platforms: PlayStationTrophyPlatform[];
  titleIconUrl: string;
  titleIconImageId: string | null;
  hasTrophyGroups: boolean;
  definedTrophies: PlayStationTrophyCounts;
  lastObservedTitleUpdatedAt: string | null;
  definitionsRefreshedAt: string;
  earningsRefreshedAt: string | null;
  earningsAccountId: string | null;
  definitionProviderPayload: unknown;
  earningsProviderPayload: unknown | null;
  createdAt: string;
  updatedAt: string;
  groups: StoredPlayStationTrophyGroup[];
}

function invalidDetails(message: string): HttpError {
  return new HttpError(409, "playstation_trophy_details_inconsistent", message);
}

function countsEqual(
  first: PlayStationTrophyCounts,
  second: PlayStationTrophyCounts,
): boolean {
  return (
    first.bronze === second.bronze &&
    first.silver === second.silver &&
    first.gold === second.gold &&
    first.platinum === second.platinum
  );
}

function countByType(
  trophies: readonly {
    trophyType: PlayStationTrophyType;
  }[],
): PlayStationTrophyCounts {
  const counts: PlayStationTrophyCounts = {
    bronze: 0,
    silver: 0,
    gold: 0,
    platinum: 0,
  };

  for (const trophy of trophies) {
    counts[trophy.trophyType] += 1;
  }

  return counts;
}

function serializeEarnings(
  result:
    | PlayStationTrophyDetailFetchResult
    | PlayStationTrophyEarningsFetchResult,
): string {
  return JSON.stringify({
    lastUpdatedAt: result.lastUpdatedAt,
    trophies: result.earnings.map((earning) => earning.providerPayload),
  });
}

function parseJson(value: string): unknown {
  return JSON.parse(value) as unknown;
}

export class PlayStationTrophyDetailRepository {
  constructor(
    private readonly database: DatabaseSync,
    private readonly clock: Clock = () => new Date(),
    private readonly activity?: BacklogActivityRecorder,
  ) {}

  storeFull(
    gameId: string,
    accountId: string,
    title: PlayStationTrophyTitlePreview,
    result: PlayStationTrophyDetailFetchResult,
  ): StoredPlayStationTrophySet {
    if (gameId.trim() === "" || accountId.trim() === "") {
      throw new Error("A game ID and PlayStation account ID are required.");
    }

    this.validateFullResult(title, result);

    const timestamp = this.clock().toISOString();
    const earningsById = new Map(
      result.earnings.map((earning) => [earning.trophyId, earning]),
    );

    this.database.exec("BEGIN IMMEDIATE");

    try {
      this.assertLinkedIdentity(gameId, title);

      this.database
        .prepare(
          `
            DELETE FROM playstation_trophy_sets
            WHERE game_id = ?
          `,
        )
        .run(gameId);

      this.database
        .prepare(
          `
            INSERT INTO playstation_trophy_sets (
              game_id,
              np_communication_id,
              np_service_name,
              trophy_set_version,
              title_name,
              title_detail,
              platforms_json,
              icon_url,
              has_trophy_groups,
              bronze_total,
              silver_total,
              gold_total,
              platinum_total,
              last_observed_title_updated_at,
              definitions_refreshed_at,
              earnings_refreshed_at,
              definition_payload_json,
              earnings_payload_json,
              created_at,
              updated_at,
              earnings_account_id
            ) VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
          `,
        )
        .run(
          gameId,
          title.npCommunicationId,
          title.npServiceName,
          result.trophySet.trophySetVersion,
          result.trophySet.titleName,
          result.trophySet.titleDetail,
          JSON.stringify(result.trophySet.platforms),
          result.trophySet.titleIconUrl,
          result.trophySet.hasTrophyGroups ? 1 : 0,
          result.trophySet.definedTrophies.bronze,
          result.trophySet.definedTrophies.silver,
          result.trophySet.definedTrophies.gold,
          result.trophySet.definedTrophies.platinum,
          title.lastUpdatedAt,
          timestamp,
          timestamp,
          JSON.stringify(result.trophySet.providerPayload),
          serializeEarnings(result),
          timestamp,
          timestamp,
          accountId,
        );

      const insertGroup = this.database.prepare(`
        INSERT INTO playstation_trophy_groups (
          game_id,
          trophy_group_id,
          name,
          detail,
          icon_url,
          bronze_total,
          silver_total,
          gold_total,
          platinum_total,
          payload_json,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const group of result.trophySet.groups) {
        insertGroup.run(
          gameId,
          group.trophyGroupId,
          group.name,
          group.detail,
          group.iconUrl,
          group.definedTrophies.bronze,
          group.definedTrophies.silver,
          group.definedTrophies.gold,
          group.definedTrophies.platinum,
          JSON.stringify(group.providerPayload),
          timestamp,
          timestamp,
        );
      }

      const insertTrophy = this.database.prepare(`
        INSERT INTO playstation_trophies (
          game_id,
          trophy_id,
          trophy_group_id,
          trophy_type,
          name,
          detail,
          icon_url,
          is_secret,
          is_earned,
          earned_at,
          rarity,
          earned_rate,
          progress_target_value,
          progress_value,
          progress_rate,
          reward_name,
          reward_image_url,
          definition_payload_json,
          earnings_payload_json,
          created_at,
          updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `);

      for (const definition of result.definitions) {
        const earning = earningsById.get(definition.trophyId);

        if (earning === undefined) {
          throw invalidDetails(
            "A trophy definition has no matching earned-state record.",
          );
        }

        insertTrophy.run(
          gameId,
          definition.trophyId,
          definition.trophyGroupId,
          definition.trophyType,
          definition.name,
          definition.detail,
          definition.iconUrl,
          definition.hidden ? 1 : 0,
          earning.earned ? 1 : 0,
          earning.earnedAt,
          earning.rarity,
          earning.earnedRate,
          earning.progressTargetValue,
          earning.progressValue,
          earning.progressRate,
          earning.rewardName,
          earning.rewardImageUrl,
          JSON.stringify(definition.providerPayload),
          JSON.stringify(earning.providerPayload),
          timestamp,
          timestamp,
        );
      }

      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }

    const stored = this.findByGameId(gameId);

    if (stored === null) {
      throw new Error(
        "The stored PlayStation trophy set could not be reconstructed.",
      );
    }

    return stored;
  }

  storeEarningsOnly(
    gameId: string,
    accountId: string,
    title: PlayStationTrophyTitlePreview,
    result: PlayStationTrophyEarningsFetchResult,
  ): StoredPlayStationTrophySet {
    if (gameId.trim() === "" || accountId.trim() === "") {
      throw new Error("A game ID and PlayStation account ID are required.");
    }

    const timestamp = this.clock().toISOString();

    this.database.exec("BEGIN IMMEDIATE");

    try {
      this.assertLinkedIdentity(gameId, title);

      const trophySet = this.database
        .prepare(
          `
            SELECT trophy_set_version
            FROM playstation_trophy_sets
            WHERE game_id = ?
          `,
        )
        .get(gameId) as unknown as { trophy_set_version: string } | undefined;

      if (trophySet === undefined) {
        throw invalidDetails(
          "Trophy earnings cannot be stored before trophy definitions.",
        );
      }

      if (trophySet.trophy_set_version !== title.trophySetVersion) {
        throw invalidDetails(
          "The stored trophy-set version no longer matches PlayStation.",
        );
      }

      const storedTrophies = this.database
        .prepare(
          `
            SELECT trophy_id, trophy_type
            FROM playstation_trophies
            WHERE game_id = ?
            ORDER BY trophy_id
          `,
        )
        .all(gameId) as unknown as ExistingTrophyIdentityRow[];

      this.validateEarnings(storedTrophies, result.earnings);

      const updateTrophy = this.database.prepare(`
        UPDATE playstation_trophies
        SET
          is_secret = ?,
          is_earned = ?,
          earned_at = ?,
          rarity = ?,
          earned_rate = ?,
          progress_target_value = ?,
          progress_value = ?,
          progress_rate = ?,
          reward_name = ?,
          reward_image_url = ?,
          earnings_payload_json = ?,
          updated_at = ?
        WHERE game_id = ?
          AND trophy_id = ?
      `);

      for (const earning of result.earnings) {
        const updateResult = updateTrophy.run(
          earning.hidden ? 1 : 0,
          earning.earned ? 1 : 0,
          earning.earnedAt,
          earning.rarity,
          earning.earnedRate,
          earning.progressTargetValue,
          earning.progressValue,
          earning.progressRate,
          earning.rewardName,
          earning.rewardImageUrl,
          JSON.stringify(earning.providerPayload),
          timestamp,
          gameId,
          earning.trophyId,
        );

        if (updateResult.changes !== 1) {
          throw invalidDetails(
            "A trophy earning did not match a stored trophy.",
          );
        }
      }

      const updateSetResult = this.database
        .prepare(
          `
            UPDATE playstation_trophy_sets
            SET
              last_observed_title_updated_at = ?,
              earnings_refreshed_at = ?,
              earnings_payload_json = ?,
              updated_at = ?,
              earnings_account_id = ?
            WHERE game_id = ?
          `,
        )
        .run(
          title.lastUpdatedAt,
          timestamp,
          serializeEarnings(result),
          timestamp,
          accountId,
          gameId,
        );

      if (updateSetResult.changes !== 1) {
        throw invalidDetails(
          "The stored trophy set disappeared during synchronization.",
        );
      }

      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }

    const stored = this.findByGameId(gameId);

    if (stored === null) {
      throw new Error(
        "The stored PlayStation trophy set could not be reconstructed.",
      );
    }

    return stored;
  }

  findByGameId(gameId: string): StoredPlayStationTrophySet | null {
    const trophySet = this.database
      .prepare(
        `
          SELECT
            game_id,
            np_communication_id,
            np_service_name,
            trophy_set_version,
            title_name,
            title_detail,
            platforms_json,
            icon_url,
            icon_image_id,
            has_trophy_groups,
            bronze_total,
            silver_total,
            gold_total,
            platinum_total,
            last_observed_title_updated_at,
            definitions_refreshed_at,
            earnings_refreshed_at,
            earnings_account_id,
            definition_payload_json,
            earnings_payload_json,
            created_at,
            updated_at
          FROM playstation_trophy_sets
          WHERE game_id = ?
        `,
      )
      .get(gameId) as unknown as StoredTrophySetRow | undefined;

    if (trophySet === undefined) {
      return null;
    }

    const groupRows = this.database
      .prepare(
        `
          SELECT
            game_id,
            trophy_group_id,
            name,
            detail,
            icon_url,
            icon_image_id,
            bronze_total,
            silver_total,
            gold_total,
            platinum_total,
            payload_json
          FROM playstation_trophy_groups
          WHERE game_id = ?
          ORDER BY
            trophy_group_id <> 'default',
            trophy_group_id
        `,
      )
      .all(gameId) as unknown as StoredGroupRow[];

    const trophyRows = this.database
      .prepare(
        `
          SELECT
            trophies.game_id AS game_id,
            trophies.trophy_id AS trophy_id,
            trophy_group_id,
            trophy_type,
            name,
            detail,
            icon_url,
            icon_image_id,
            is_secret,
            is_earned,
            earned_at,
            rarity,
            earned_rate,
            progress_target_value,
            progress_value,
            progress_rate,
            reward_name,
            reward_image_url,
            definition_payload_json,
            earnings_payload_json,
            CASE WHEN availability.game_id IS NULL THEN 0 ELSE 1 END
              AS is_unobtainable,
            availability.reason AS unobtainable_reason,
            availability.updated_at AS availability_updated_at
          FROM playstation_trophies trophies
          LEFT JOIN playstation_trophy_availability_overrides availability
            ON availability.game_id = trophies.game_id
            AND availability.trophy_id = trophies.trophy_id
          WHERE trophies.game_id = ?
          ORDER BY trophies.trophy_id
        `,
      )
      .all(gameId) as unknown as StoredTrophyRow[];

    const trophiesByGroup = new Map<string, StoredPlayStationTrophy[]>();

    for (const row of trophyRows) {
      const trophies = trophiesByGroup.get(row.trophy_group_id) ?? [];

      trophies.push({
        trophyId: row.trophy_id,
        trophyGroupId: row.trophy_group_id,
        trophyType: row.trophy_type,
        name: row.name,
        detail: row.detail,
        iconUrl: row.icon_url,
        iconImageId: row.icon_image_id,
        secret: row.is_secret === 1,
        earned: row.is_earned === 1,
        earnedAt: row.earned_at,
        rarity:
          row.rarity === null ? null : (row.rarity as PlayStationTrophyRarity),
        earnedRate: row.earned_rate,
        progressTargetValue: row.progress_target_value,
        progressValue: row.progress_value,
        progressRate: row.progress_rate,
        rewardName: row.reward_name,
        rewardImageUrl: row.reward_image_url,
        definitionProviderPayload: parseJson(row.definition_payload_json),
        earningsProviderPayload:
          row.earnings_payload_json === null
            ? null
            : parseJson(row.earnings_payload_json),
        unobtainable: row.is_unobtainable === 1,
        unobtainableReason: row.unobtainable_reason,
        availabilityUpdatedAt: row.availability_updated_at,
      });

      trophiesByGroup.set(row.trophy_group_id, trophies);
    }

    return {
      gameId: trophySet.game_id,
      npCommunicationId: trophySet.np_communication_id,
      npServiceName: trophySet.np_service_name,
      trophySetVersion: trophySet.trophy_set_version,
      titleName: trophySet.title_name,
      titleDetail: trophySet.title_detail,
      platforms: JSON.parse(
        trophySet.platforms_json,
      ) as PlayStationTrophyPlatform[],
      titleIconUrl: trophySet.icon_url,
      titleIconImageId: trophySet.icon_image_id,
      hasTrophyGroups: trophySet.has_trophy_groups === 1,
      definedTrophies: {
        bronze: trophySet.bronze_total,
        silver: trophySet.silver_total,
        gold: trophySet.gold_total,
        platinum: trophySet.platinum_total,
      },
      lastObservedTitleUpdatedAt: trophySet.last_observed_title_updated_at,
      definitionsRefreshedAt: trophySet.definitions_refreshed_at,
      earningsRefreshedAt: trophySet.earnings_refreshed_at,
      earningsAccountId: trophySet.earnings_account_id,
      definitionProviderPayload: parseJson(trophySet.definition_payload_json),
      earningsProviderPayload:
        trophySet.earnings_payload_json === null
          ? null
          : parseJson(trophySet.earnings_payload_json),
      createdAt: trophySet.created_at,
      updatedAt: trophySet.updated_at,
      groups: groupRows.map((row) => ({
        trophyGroupId: row.trophy_group_id,
        name: row.name,
        detail: row.detail,
        iconUrl: row.icon_url,
        iconImageId: row.icon_image_id,
        definedTrophies: {
          bronze: row.bronze_total,
          silver: row.silver_total,
          gold: row.gold_total,
          platinum: row.platinum_total,
        },
        providerPayload: parseJson(row.payload_json),
        trophies: trophiesByGroup.get(row.trophy_group_id) ?? [],
      })),
    };
  }

  updateTrophyAvailability(
    gameId: string,
    trophyId: number,
    input: UpdatePlayStationTrophyAvailabilityInput,
  ): StoredPlayStationTrophySet | null {
    const trophy = this.database
      .prepare(
        `
          SELECT
            trophies.trophy_id,
            trophies.trophy_type,
            trophies.name,
            games.title AS game_title,
            CASE
              WHEN availability.trophy_id IS NULL THEN 0
              ELSE 1
            END AS was_unobtainable,
            availability.reason AS previous_reason
          FROM playstation_trophies trophies
          INNER JOIN library_games games
            ON games.id = trophies.game_id
          LEFT JOIN playstation_trophy_availability_overrides availability
            ON availability.game_id = trophies.game_id
            AND availability.trophy_id = trophies.trophy_id
          WHERE
            trophies.game_id = ?
            AND trophies.trophy_id = ?
        `,
      )
      .get(gameId, trophyId) as unknown as
      | TrophyAvailabilityHistoryRow
      | undefined;

    if (trophy === undefined) {
      return null;
    }

    const timestamp = this.clock().toISOString();

    this.database.exec("BEGIN IMMEDIATE");

    try {
      if (input.unobtainable) {
        this.database
          .prepare(
            `
              INSERT INTO playstation_trophy_availability_overrides (
                game_id,
                trophy_id,
                reason,
                updated_at
              ) VALUES (?, ?, ?, ?)
              ON CONFLICT (game_id, trophy_id) DO UPDATE SET
                reason = excluded.reason,
                updated_at = excluded.updated_at
            `,
          )
          .run(gameId, trophyId, input.reason, timestamp);
      } else {
        this.database
          .prepare(
            `
              DELETE FROM playstation_trophy_availability_overrides
              WHERE game_id = ? AND trophy_id = ?
            `,
          )
          .run(gameId, trophyId);
      }

      this.database
        .prepare(
          `
            UPDATE library_games
            SET
              is_unobtainable = CASE
                WHEN EXISTS (
                  SELECT 1
                  FROM playstation_trophy_availability_overrides availability
                  WHERE availability.game_id = ?
                )
                THEN 1
                ELSE 0
              END,
              updated_at = ?
            WHERE id = ?
          `,
        )
        .run(gameId, timestamp, gameId);

      const availabilityChanged =
        (trophy.was_unobtainable === 1) !== input.unobtainable;

      if (availabilityChanged) {
        this.activity?.recordTrophyAvailabilityChanged(
          {
            gameId,
            gameTitle: trophy.game_title,
            trophyId: trophy.trophy_id,
            trophyName: trophy.name,
            trophyType: trophy.trophy_type,
            unobtainable: input.unobtainable,
            reason: input.unobtainable ? input.reason : trophy.previous_reason,
          },
          timestamp,
        );
      }

      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }

    return this.findByGameId(gameId);
  }

  private assertLinkedIdentity(
    gameId: string,
    title: PlayStationTrophyTitlePreview,
  ): void {
    const link = this.database
      .prepare(
        `
          SELECT np_communication_id, np_service_name
          FROM playstation_game_links
          WHERE game_id = ?
        `,
      )
      .get(gameId) as unknown as LinkRow | undefined;

    if (link === undefined) {
      throw invalidDetails(
        "The library game is not linked to a PlayStation trophy set.",
      );
    }

    if (
      link.np_communication_id !== title.npCommunicationId ||
      link.np_service_name !== title.npServiceName
    ) {
      throw invalidDetails(
        "The PlayStation title does not match the linked library game.",
      );
    }
  }

  private validateFullResult(
    title: PlayStationTrophyTitlePreview,
    result: PlayStationTrophyDetailFetchResult,
  ): void {
    if (
      result.trophySet.trophySetVersion !== title.trophySetVersion ||
      !countsEqual(result.trophySet.definedTrophies, title.definedTrophies) ||
      result.trophySet.hasTrophyGroups !== title.hasTrophyGroups
    ) {
      throw invalidDetails(
        "The fetched trophy set does not match its title preview.",
      );
    }

    if (
      !countsEqual(
        countByType(result.definitions),
        result.trophySet.definedTrophies,
      )
    ) {
      throw invalidDetails(
        "The fetched trophy definitions do not match the trophy totals.",
      );
    }

    const groupIds = new Set(
      result.trophySet.groups.map((group) => group.trophyGroupId),
    );

    if (
      groupIds.size !== result.trophySet.groups.length ||
      !groupIds.has("default")
    ) {
      throw invalidDetails(
        "The fetched trophy groups are incomplete or duplicated.",
      );
    }

    const earningsById = new Map(
      result.earnings.map((earning) => [earning.trophyId, earning]),
    );

    if (
      earningsById.size !== result.earnings.length ||
      result.earnings.length !== result.definitions.length
    ) {
      throw invalidDetails(
        "The fetched trophy earnings do not match the definitions.",
      );
    }

    for (const definition of result.definitions) {
      const earning = earningsById.get(definition.trophyId);

      if (
        !groupIds.has(definition.trophyGroupId) ||
        earning === undefined ||
        earning.trophyType !== definition.trophyType
      ) {
        throw invalidDetails(
          "The fetched trophy IDs, groups, or types are inconsistent.",
        );
      }
    }
  }

  private validateEarnings(
    stored: readonly ExistingTrophyIdentityRow[],
    earnings: readonly PlayStationTrophyEarning[],
  ): void {
    const storedById = new Map(
      stored.map((trophy) => [trophy.trophy_id, trophy.trophy_type]),
    );

    const seenIds = new Set<number>();

    if (stored.length !== earnings.length) {
      throw invalidDetails(
        "The fetched trophy earnings do not match the stored definitions.",
      );
    }

    for (const earning of earnings) {
      if (
        seenIds.has(earning.trophyId) ||
        storedById.get(earning.trophyId) !== earning.trophyType
      ) {
        throw invalidDetails(
          "The fetched trophy earnings contain unexpected IDs or types.",
        );
      }

      seenIds.add(earning.trophyId);
    }
  }
}
