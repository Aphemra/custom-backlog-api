import type { Migration } from "../migration.js";

export const initialSchemaMigration: Migration = {
  version: 1,
  name: "current_schema_baseline",
  sql: `
    CREATE TABLE library_games (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL CHECK (length(trim(title)) > 0),
      sort_title TEXT NOT NULL CHECK (length(trim(sort_title)) > 0),
      platform TEXT NOT NULL CHECK (platform IN ('PS3', 'PS4', 'PS5')),
      play_status TEXT NOT NULL DEFAULT 'not_started'
        CHECK (play_status IN (
          'unreleased',
          'not_started',
          'playing',
          'on_hold',
          'waiting',
          'completed'
        )),
      is_unobtainable INTEGER NOT NULL DEFAULT 0
        CHECK (is_unobtainable IN (0, 1)),
      priority_rank INTEGER NOT NULL DEFAULT 0
        CHECK (priority_rank >= 0),
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT
    ) STRICT;

    CREATE INDEX library_games_sort_index
      ON library_games (
        archived_at,
        priority_rank,
        sort_title
      );

    CREATE INDEX library_games_play_status_index
      ON library_games (
        archived_at,
        play_status,
        is_unobtainable,
        priority_rank,
        sort_title
      );

    CREATE TABLE external_game_metadata (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      external_id TEXT NOT NULL,
      title TEXT NOT NULL,
      cover_url TEXT,
      release_date TEXT,
      payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
      fetched_at TEXT NOT NULL,
      UNIQUE (provider, external_id)
    ) STRICT;

    CREATE TABLE game_metadata_links (
      game_id TEXT PRIMARY KEY
        REFERENCES library_games(id) ON DELETE CASCADE,
      metadata_id TEXT NOT NULL
        REFERENCES external_game_metadata(id) ON DELETE RESTRICT,
      linked_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE collections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL CHECK (length(trim(name)) > 0),
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
        CHECK (sort_order >= 0),
      is_pinned INTEGER NOT NULL DEFAULT 0
        CHECK (is_pinned IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE INDEX collections_sort_index
      ON collections (sort_order, name);

    CREATE UNIQUE INDEX collections_single_pinned
      ON collections (is_pinned)
      WHERE is_pinned = 1;

    CREATE TABLE collection_games (
      collection_id TEXT NOT NULL
        REFERENCES collections(id) ON DELETE CASCADE,
      game_id TEXT NOT NULL
        REFERENCES library_games(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0
        CHECK (sort_order >= 0),
      added_at TEXT NOT NULL,
      PRIMARY KEY (collection_id, game_id)
    ) STRICT;

    CREATE INDEX collection_games_sort_index
      ON collection_games (
        collection_id,
        sort_order
      );

    CREATE TABLE saved_views (
      id TEXT PRIMARY KEY,
      builtin_key TEXT UNIQUE,
      name TEXT NOT NULL CHECK (length(trim(name)) > 0),
      filters_json TEXT NOT NULL CHECK (json_valid(filters_json)),
      sort_json TEXT NOT NULL CHECK (json_valid(sort_json)),
      sort_order INTEGER NOT NULL DEFAULT 0
        CHECK (sort_order >= 0),
      is_builtin INTEGER NOT NULL DEFAULT 0
        CHECK (is_builtin IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK (
        (is_builtin = 1 AND builtin_key IS NOT NULL)
        OR
        (is_builtin = 0 AND builtin_key IS NULL)
      )
    ) STRICT;

    CREATE INDEX saved_views_sort_index
      ON saved_views (sort_order, name);

    CREATE TABLE trophy_sync_runs (
      id TEXT PRIMARY KEY,
      target_account_id TEXT NOT NULL,
      reader_account_id TEXT,
      status TEXT NOT NULL
        CHECK (status IN ('running', 'succeeded', 'partial', 'failed')),
      request_count INTEGER NOT NULL DEFAULT 0
        CHECK (request_count >= 0),
      expected_title_count INTEGER
        CHECK (
          expected_title_count IS NULL
          OR expected_title_count >= 0
        ),
      processed_title_count INTEGER NOT NULL DEFAULT 0
        CHECK (processed_title_count >= 0),
      started_at TEXT NOT NULL,
      finished_at TEXT,
      error_code TEXT,
      error_message TEXT
    ) STRICT;

    CREATE TABLE trophy_snapshots (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL
        REFERENCES library_games(id) ON DELETE CASCADE,
      sync_run_id TEXT
        REFERENCES trophy_sync_runs(id) ON DELETE SET NULL,
      captured_at TEXT NOT NULL,
      bronze_total INTEGER NOT NULL CHECK (bronze_total >= 0),
      silver_total INTEGER NOT NULL CHECK (silver_total >= 0),
      gold_total INTEGER NOT NULL CHECK (gold_total >= 0),
      platinum_total INTEGER NOT NULL CHECK (platinum_total >= 0),
      bronze_earned INTEGER NOT NULL
        CHECK (bronze_earned BETWEEN 0 AND bronze_total),
      silver_earned INTEGER NOT NULL
        CHECK (silver_earned BETWEEN 0 AND silver_total),
      gold_earned INTEGER NOT NULL
        CHECK (gold_earned BETWEEN 0 AND gold_total),
      platinum_earned INTEGER NOT NULL
        CHECK (platinum_earned BETWEEN 0 AND platinum_total),
      progress_percent INTEGER NOT NULL
        CHECK (progress_percent BETWEEN 0 AND 100),
      is_100_percent INTEGER NOT NULL
        CHECK (is_100_percent IN (0, 1)),
      has_platinum INTEGER NOT NULL
        CHECK (has_platinum IN (0, 1)),
      payload_json TEXT
        CHECK (
          payload_json IS NULL
          OR json_valid(payload_json)
        ),
      UNIQUE (game_id, captured_at)
    ) STRICT;

    CREATE INDEX trophy_snapshots_game_index
      ON trophy_snapshots (
        game_id,
        captured_at DESC
      );

    CREATE TABLE trophy_alerts (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL
        REFERENCES library_games(id) ON DELETE CASCADE,
      kind TEXT NOT NULL
        CHECK (kind IN ('new_trophies', 'completion_lost')),
      status TEXT NOT NULL DEFAULT 'unread'
        CHECK (status IN ('unread', 'read', 'resolved', 'dismissed')),
      previous_snapshot_id TEXT
        REFERENCES trophy_snapshots(id) ON DELETE SET NULL,
      current_snapshot_id TEXT NOT NULL
        REFERENCES trophy_snapshots(id) ON DELETE CASCADE,
      details_json TEXT NOT NULL CHECK (json_valid(details_json)),
      created_at TEXT NOT NULL,
      resolved_at TEXT,
      UNIQUE (kind, current_snapshot_id)
    ) STRICT;

    CREATE INDEX trophy_alerts_status_index
      ON trophy_alerts (
        status,
        created_at DESC
      );

    CREATE TABLE app_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL CHECK (json_valid(value_json)),
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE playstation_game_links (
      game_id TEXT PRIMARY KEY
        REFERENCES library_games(id) ON DELETE CASCADE,
      np_communication_id TEXT NOT NULL UNIQUE
        CHECK (length(trim(np_communication_id)) > 0),
      np_service_name TEXT NOT NULL
        CHECK (np_service_name IN ('trophy', 'trophy2')),
      psn_title_name TEXT NOT NULL
        CHECK (length(trim(psn_title_name)) > 0),
      platforms_json TEXT NOT NULL
        CHECK (
          json_valid(platforms_json)
          AND json_type(platforms_json) = 'array'
        ),
      icon_url TEXT,
      link_source TEXT NOT NULL
        CHECK (link_source IN (
          'sync_created',
          'automatic_match',
          'manual_match'
        )),
      payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
      linked_at TEXT NOT NULL,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    ) STRICT;

    CREATE INDEX playstation_game_links_last_seen_index
      ON playstation_game_links (last_seen_at DESC);

    CREATE TABLE cached_images (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL
        CHECK (provider IN ('igdb', 'playstation')),
      source_key TEXT NOT NULL
        CHECK (length(trim(source_key)) > 0),
      source_url TEXT NOT NULL
        CHECK (length(trim(source_url)) > 0),
      file_name TEXT UNIQUE,
      content_type TEXT
        CHECK (
          content_type IS NULL
          OR content_type IN (
            'image/jpeg',
            'image/png',
            'image/webp'
          )
        ),
      byte_size INTEGER
        CHECK (
          byte_size IS NULL
          OR byte_size >= 0
        ),
      etag TEXT,
      last_modified TEXT,
      fetched_at TEXT,
      last_checked_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (provider, source_key),
      CHECK (
        (
          file_name IS NULL
          AND content_type IS NULL
          AND byte_size IS NULL
          AND fetched_at IS NULL
        )
        OR
        (
          file_name IS NOT NULL
          AND content_type IS NOT NULL
          AND byte_size IS NOT NULL
          AND fetched_at IS NOT NULL
        )
      )
    ) STRICT;

    CREATE INDEX cached_images_provider_index
      ON cached_images (
        provider,
        updated_at DESC
      );

    CREATE TABLE library_game_images (
      game_id TEXT NOT NULL
        REFERENCES library_games(id) ON DELETE CASCADE,
      image_id TEXT NOT NULL
        REFERENCES cached_images(id) ON DELETE CASCADE,
      role TEXT NOT NULL
        CHECK (role IN ('cover', 'icon', 'background')),
      sort_order INTEGER NOT NULL DEFAULT 0
        CHECK (sort_order >= 0),
      linked_at TEXT NOT NULL,
      PRIMARY KEY (game_id, image_id, role)
    ) STRICT;

    CREATE INDEX library_game_images_order_index
      ON library_game_images (
        game_id,
        role,
        sort_order
      );

    CREATE TABLE playstation_profile_snapshots (
      id TEXT PRIMARY KEY,
      sync_run_id TEXT NOT NULL UNIQUE
        REFERENCES trophy_sync_runs(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL
        CHECK (length(trim(account_id)) > 0),
      captured_at TEXT NOT NULL,
      trophy_level INTEGER NOT NULL
        CHECK (trophy_level >= 0),
      level_progress_percent INTEGER NOT NULL
        CHECK (level_progress_percent BETWEEN 0 AND 100),
      tier INTEGER NOT NULL
        CHECK (tier BETWEEN 1 AND 10),
      bronze_earned INTEGER NOT NULL
        CHECK (bronze_earned >= 0),
      silver_earned INTEGER NOT NULL
        CHECK (silver_earned >= 0),
      gold_earned INTEGER NOT NULL
        CHECK (gold_earned >= 0),
      platinum_earned INTEGER NOT NULL
        CHECK (platinum_earned >= 0),
      payload_json TEXT NOT NULL CHECK (json_valid(payload_json))
    ) STRICT;

    CREATE INDEX playstation_profile_snapshots_account_index
      ON playstation_profile_snapshots (
        account_id,
        captured_at DESC
      );

    CREATE TABLE playstation_trophy_sets (
      game_id TEXT PRIMARY KEY
        REFERENCES playstation_game_links(game_id) ON DELETE CASCADE,
      np_communication_id TEXT NOT NULL UNIQUE
        CHECK (length(trim(np_communication_id)) > 0),
      np_service_name TEXT NOT NULL
        CHECK (np_service_name IN ('trophy', 'trophy2')),
      trophy_set_version TEXT NOT NULL
        CHECK (length(trim(trophy_set_version)) > 0),
      title_name TEXT NOT NULL
        CHECK (length(trim(title_name)) > 0),
      title_detail TEXT,
      platforms_json TEXT NOT NULL
        CHECK (
          json_valid(platforms_json)
          AND json_type(platforms_json) = 'array'
        ),
      icon_url TEXT NOT NULL
        CHECK (length(trim(icon_url)) > 0),
      icon_image_id TEXT
        REFERENCES cached_images(id) ON DELETE SET NULL,
      has_trophy_groups INTEGER NOT NULL
        CHECK (has_trophy_groups IN (0, 1)),
      bronze_total INTEGER NOT NULL DEFAULT 0
        CHECK (bronze_total >= 0),
      silver_total INTEGER NOT NULL DEFAULT 0
        CHECK (silver_total >= 0),
      gold_total INTEGER NOT NULL DEFAULT 0
        CHECK (gold_total >= 0),
      platinum_total INTEGER NOT NULL DEFAULT 0
        CHECK (platinum_total IN (0, 1)),
      last_observed_title_updated_at TEXT,
      definitions_refreshed_at TEXT NOT NULL,
      earnings_refreshed_at TEXT,
      earnings_account_id TEXT
        CHECK (
          earnings_account_id IS NULL
          OR length(trim(earnings_account_id)) > 0
        ),
      definition_payload_json TEXT NOT NULL
        CHECK (json_valid(definition_payload_json)),
      earnings_payload_json TEXT
        CHECK (
          earnings_payload_json IS NULL
          OR json_valid(earnings_payload_json)
        ),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE INDEX playstation_trophy_sets_provider_index
      ON playstation_trophy_sets (
        np_communication_id,
        np_service_name
      );

    CREATE TABLE playstation_trophy_groups (
      game_id TEXT NOT NULL
        REFERENCES playstation_trophy_sets(game_id) ON DELETE CASCADE,
      trophy_group_id TEXT NOT NULL
        CHECK (length(trim(trophy_group_id)) > 0),
      name TEXT NOT NULL
        CHECK (length(trim(name)) > 0),
      detail TEXT,
      icon_url TEXT NOT NULL
        CHECK (length(trim(icon_url)) > 0),
      icon_image_id TEXT
        REFERENCES cached_images(id) ON DELETE SET NULL,
      bronze_total INTEGER NOT NULL
        CHECK (bronze_total >= 0),
      silver_total INTEGER NOT NULL
        CHECK (silver_total >= 0),
      gold_total INTEGER NOT NULL
        CHECK (gold_total >= 0),
      platinum_total INTEGER NOT NULL
        CHECK (platinum_total IN (0, 1)),
      payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (game_id, trophy_group_id)
    ) STRICT;

    CREATE INDEX playstation_trophy_groups_game_index
      ON playstation_trophy_groups (
        game_id,
        trophy_group_id
      );

    CREATE TABLE playstation_trophies (
      game_id TEXT NOT NULL,
      trophy_id INTEGER NOT NULL
        CHECK (trophy_id >= 0),
      trophy_group_id TEXT NOT NULL
        CHECK (length(trim(trophy_group_id)) > 0),
      trophy_type TEXT NOT NULL
        CHECK (trophy_type IN (
          'bronze',
          'silver',
          'gold',
          'platinum'
        )),
      name TEXT,
      detail TEXT,
      icon_url TEXT,
      icon_image_id TEXT
        REFERENCES cached_images(id) ON DELETE SET NULL,
      is_secret INTEGER NOT NULL
        CHECK (is_secret IN (0, 1)),
      is_earned INTEGER NOT NULL DEFAULT 0
        CHECK (is_earned IN (0, 1)),
      earned_at TEXT,
      rarity INTEGER
        CHECK (
          rarity IS NULL
          OR rarity BETWEEN 0 AND 3
        ),
      earned_rate REAL
        CHECK (
          earned_rate IS NULL
          OR earned_rate BETWEEN 0 AND 100
        ),
      progress_target_value TEXT,
      progress_value TEXT,
      progress_rate REAL
        CHECK (
          progress_rate IS NULL
          OR progress_rate BETWEEN 0 AND 100
        ),
      reward_name TEXT,
      reward_image_url TEXT,
      definition_payload_json TEXT NOT NULL
        CHECK (json_valid(definition_payload_json)),
      earnings_payload_json TEXT
        CHECK (
          earnings_payload_json IS NULL
          OR json_valid(earnings_payload_json)
        ),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (game_id, trophy_id),
      FOREIGN KEY (game_id, trophy_group_id)
        REFERENCES playstation_trophy_groups (
          game_id,
          trophy_group_id
        )
        ON DELETE CASCADE,
      CHECK (
        is_earned = 1
        OR earned_at IS NULL
      )
    ) STRICT;

    CREATE INDEX playstation_trophies_group_index
      ON playstation_trophies (
        game_id,
        trophy_group_id,
        trophy_id
      );

    CREATE INDEX playstation_trophies_earned_index
      ON playstation_trophies (
        game_id,
        is_earned,
        earned_at
      );

    CREATE TABLE playstation_trophy_availability_overrides (
      game_id TEXT NOT NULL
        REFERENCES library_games(id) ON DELETE CASCADE,
      trophy_id INTEGER NOT NULL
        CHECK (trophy_id >= 0),
      reason TEXT
        CHECK (
          reason IS NULL
          OR length(trim(reason)) BETWEEN 1 AND 500
        ),
      updated_at TEXT NOT NULL,
      PRIMARY KEY (game_id, trophy_id)
    ) STRICT;

    CREATE INDEX playstation_trophy_availability_game_index
      ON playstation_trophy_availability_overrides (
        game_id,
        trophy_id
      );

    CREATE TABLE igdb_game_details (
      metadata_id TEXT PRIMARY KEY
        REFERENCES external_game_metadata(id) ON DELETE CASCADE,
      slug TEXT,
      igdb_url TEXT,
      summary TEXT,
      storyline TEXT,
      platforms_json TEXT NOT NULL CHECK (json_valid(platforms_json)),
      releases_json TEXT NOT NULL CHECK (json_valid(releases_json)),
      cover_image_id TEXT,
      screenshots_json TEXT NOT NULL CHECK (json_valid(screenshots_json)),
      artworks_json TEXT NOT NULL CHECK (json_valid(artworks_json)),
      genres_json TEXT NOT NULL CHECK (json_valid(genres_json)),
      game_modes_json TEXT NOT NULL CHECK (json_valid(game_modes_json)),
      companies_json TEXT NOT NULL CHECK (json_valid(companies_json)),
      collections_json TEXT NOT NULL CHECK (json_valid(collections_json)),
      franchises_json TEXT NOT NULL CHECK (json_valid(franchises_json)),
      game_type_external_id TEXT NOT NULL,
      game_type_name TEXT,
      parent_game_external_id TEXT,
      version_title TEXT,
      total_rating REAL CHECK (total_rating >= 0),
      total_rating_count INTEGER NOT NULL
        CHECK (total_rating_count >= 0),
      time_hastily_seconds INTEGER
        CHECK (time_hastily_seconds > 0),
      time_normally_seconds INTEGER
        CHECK (time_normally_seconds > 0),
      time_completely_seconds INTEGER
        CHECK (time_completely_seconds > 0),
      time_submission_count INTEGER NOT NULL
        CHECK (time_submission_count >= 0),
      provider_updated_at TEXT,
      is_dlc INTEGER NOT NULL CHECK (is_dlc IN (0, 1)),
      stored_at TEXT NOT NULL
    ) STRICT;

    CREATE INDEX igdb_game_details_type_index
      ON igdb_game_details (
        game_type_external_id,
        is_dlc
      );

    CREATE TABLE igdb_metadata_images (
      metadata_id TEXT NOT NULL
        REFERENCES external_game_metadata(id) ON DELETE CASCADE,
      image_id TEXT NOT NULL
        REFERENCES cached_images(id) ON DELETE CASCADE,
      role TEXT NOT NULL
        CHECK (role IN ('cover', 'screenshot', 'artwork')),
      sort_order INTEGER NOT NULL
        CHECK (sort_order >= 0),
      width INTEGER
        CHECK (
          width IS NULL
          OR width > 0
        ),
      height INTEGER
        CHECK (
          height IS NULL
          OR height > 0
        ),
      linked_at TEXT NOT NULL,
      PRIMARY KEY (metadata_id, image_id, role),
      UNIQUE (metadata_id, role, sort_order)
    ) STRICT;

    CREATE INDEX igdb_metadata_images_order_index
      ON igdb_metadata_images (
        metadata_id,
        role,
        sort_order
      );

    CREATE TABLE game_resources (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL
        REFERENCES library_games(id) ON DELETE CASCADE,
      resource_type TEXT NOT NULL
        CHECK (resource_type IN (
          'trophy_page',
          'guide',
          'interactive_map'
        )),
      provider TEXT NOT NULL
        CHECK (provider IN (
          'psnprofiles',
          'powerpyx',
          'mapgenie',
          'other'
        )),
      url TEXT NOT NULL
        CHECK (
          url = trim(url)
          AND length(url) BETWEEN 1 AND 2048
          AND substr(url, 1, 8) = 'https://'
        ),
      label TEXT
        CHECK (
          label IS NULL
          OR (
            label = trim(label)
            AND length(label) BETWEEN 1 AND 100
          )
        ),
      sort_order INTEGER NOT NULL
        CHECK (sort_order >= 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK (
        (
          resource_type = 'trophy_page'
          AND provider = 'psnprofiles'
        )
        OR
        (
          resource_type = 'guide'
          AND provider IN (
            'psnprofiles',
            'powerpyx',
            'other'
          )
        )
        OR
        (
          resource_type = 'interactive_map'
          AND provider IN (
            'mapgenie',
            'other'
          )
        )
      )
    ) STRICT;

    CREATE INDEX game_resources_game_order_index
      ON game_resources (
        game_id,
        sort_order,
        id
      );

    CREATE UNIQUE INDEX game_resources_game_url_unique
      ON game_resources (
        game_id,
        url
      );

    CREATE UNIQUE INDEX game_resources_trophy_page_unique
      ON game_resources (game_id)
      WHERE resource_type = 'trophy_page';

    CREATE TABLE playstation_credential_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      reader_online_id TEXT,
      target_online_id TEXT,
      npsso_ciphertext TEXT,
      npsso_iv TEXT,
      npsso_auth_tag TEXT,
      npsso_updated_at TEXT,
      npsso_expected_renewal_at TEXT,
      renewal_reminder_days INTEGER NOT NULL DEFAULT 7
        CHECK (
          renewal_reminder_days >= 1
          AND renewal_reminder_days <= 30
        ),
      updated_at TEXT NOT NULL,
      CHECK (
        (
          npsso_ciphertext IS NULL
          AND npsso_iv IS NULL
          AND npsso_auth_tag IS NULL
          AND npsso_updated_at IS NULL
          AND npsso_expected_renewal_at IS NULL
        )
        OR
        (
          npsso_ciphertext IS NOT NULL
          AND npsso_iv IS NOT NULL
          AND npsso_auth_tag IS NOT NULL
          AND npsso_updated_at IS NOT NULL
          AND npsso_expected_renewal_at IS NOT NULL
        )
      )
    ) STRICT;

    CREATE TABLE backlog_history_entries (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL
        CHECK (action IN (
          'game_added',
          'game_hidden',
          'game_unhidden',
          'game_deleted',
          'play_status_changed',
          'game_platform_changed',
          'library_reordered',
          'trophy_marked_unobtainable',
          'trophy_restored',
          'collection_created',
          'collection_updated',
          'collection_deleted',
          'collection_pinned',
          'collection_unpinned',
          'collection_membership_changed',
          'collection_reordered',
          'collection_games_reordered',
          'backlog_imported',
          'backlog_deleted'
        )),
      source TEXT NOT NULL
        CHECK (source IN (
          'user',
          'playstation_sync',
          'portable_import',
          'system'
        )),
      occurred_at TEXT NOT NULL,
      game_id TEXT
        CHECK (
          game_id IS NULL
          OR (
            game_id = trim(game_id)
            AND length(game_id) BETWEEN 1 AND 200
          )
        ),
      game_title TEXT
        CHECK (
          game_title IS NULL
          OR (
            game_title = trim(game_title)
            AND length(game_title) BETWEEN 1 AND 300
          )
        ),
      collection_id TEXT
        CHECK (
          collection_id IS NULL
          OR (
            collection_id = trim(collection_id)
            AND length(collection_id) BETWEEN 1 AND 200
          )
        ),
      collection_name TEXT
        CHECK (
          collection_name IS NULL
          OR (
            collection_name = trim(collection_name)
            AND length(collection_name) BETWEEN 1 AND 200
          )
        ),
      previous_play_status TEXT
        CHECK (
          previous_play_status IS NULL
          OR previous_play_status IN (
            'unreleased',
            'not_started',
            'playing',
            'on_hold',
            'waiting',
            'completed'
          )
        ),
      next_play_status TEXT
        CHECK (
          next_play_status IS NULL
          OR next_play_status IN (
            'unreleased',
            'not_started',
            'playing',
            'on_hold',
            'waiting',
            'completed'
          )
        ),
      summary TEXT NOT NULL
        CHECK (
          summary = trim(summary)
          AND length(summary) BETWEEN 1 AND 500
        ),
      details_json TEXT NOT NULL
        CHECK (
          json_valid(details_json)
          AND json_type(details_json) = 'object'
        ),
      CHECK (
        (game_id IS NULL AND game_title IS NULL)
        OR
        (game_id IS NOT NULL AND game_title IS NOT NULL)
      ),
      CHECK (
        (collection_id IS NULL AND collection_name IS NULL)
        OR
        (collection_id IS NOT NULL AND collection_name IS NOT NULL)
      )
    ) STRICT;

    CREATE INDEX backlog_history_occurred_index
      ON backlog_history_entries (
        occurred_at DESC,
        id DESC
      );

    CREATE INDEX backlog_history_game_index
      ON backlog_history_entries (
        game_id,
        occurred_at DESC
      )
      WHERE game_id IS NOT NULL;

    CREATE INDEX backlog_history_collection_index
      ON backlog_history_entries (
        collection_id,
        occurred_at DESC
      )
      WHERE collection_id IS NOT NULL;

    CREATE INDEX backlog_history_action_index
      ON backlog_history_entries (
        action,
        occurred_at DESC
      );

    INSERT INTO saved_views (
      id,
      builtin_key,
      name,
      filters_json,
      sort_json,
      sort_order,
      is_builtin,
      created_at,
      updated_at
    ) VALUES
      (
        'builtin-all-games',
        'all_games',
        'All games',
        '{}',
        '{"field":"priorityRank","direction":"asc"}',
        0,
        1,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      ),
      (
        'builtin-pursuing-soon',
        'not_started',
        'Not started',
        '{"playStatuses":["not_started"]}',
        '{"field":"priorityRank","direction":"asc"}',
        10,
        1,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      ),
      (
        'builtin-in-progress',
        'playing',
        'Playing',
        '{"playStatuses":["playing"]}',
        '{"field":"updatedAt","direction":"desc"}',
        20,
        1,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      ),
      (
        'builtin-platinum-earned',
        'platinum_earned',
        'Platinum earned',
        '{"platinumEarned":true}',
        '{"field":"title","direction":"asc"}',
        30,
        1,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      ),
      (
        'builtin-100-percent',
        'one_hundred_percent',
        '100% complete',
        '{"is100Percent":true}',
        '{"field":"title","direction":"asc"}',
        40,
        1,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      ),
      (
        'builtin-completion-lost',
        'completion_lost',
        'Completion lost',
        '{"alertKinds":["completion_lost"],"alertStatus":"unread"}',
        '{"field":"alertCreatedAt","direction":"desc"}',
        50,
        1,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      ),
      (
        'builtin-needs-sync',
        'needs_sync',
        'Needs synchronization',
        '{"needsSync":true}',
        '{"field":"lastSyncedAt","direction":"asc"}',
        60,
        1,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      ),
      (
        'builtin-hidden-games',
        'hidden_games',
        'Hidden Games',
        '{"hiddenMode":"hidden"}',
        '{"field":"priorityRank","direction":"asc"}',
        70,
        1,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      );

    INSERT INTO app_settings (
      key,
      value_json,
      updated_at
    ) VALUES (
      'application',
      '{"trophySyncCooldownEnabled":true,"trophySyncCooldownSeconds":300,"notificationDurationSeconds":5}',
      CURRENT_TIMESTAMP
    );

    INSERT INTO playstation_credential_settings (
      id,
      reader_online_id,
      target_online_id,
      npsso_ciphertext,
      npsso_iv,
      npsso_auth_tag,
      npsso_updated_at,
      npsso_expected_renewal_at,
      renewal_reminder_days,
      updated_at
    ) VALUES (
      1,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      7,
      CURRENT_TIMESTAMP
    );
  `,
};
