import type { Migration } from "../migration.js";

export const initialSchemaMigration: Migration = {
  version: 1,
  name: "initial_schema",
  sql: `
    CREATE TABLE library_games (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL CHECK (length(trim(title)) > 0),
      sort_title TEXT NOT NULL CHECK (length(trim(sort_title)) > 0),
      platform TEXT NOT NULL CHECK (platform IN ('PS3', 'PS4', 'PS5')),
      pursuit_status TEXT NOT NULL DEFAULT 'unplanned'
        CHECK (pursuit_status IN (
          'unplanned',
          'pursuing_soon',
          'in_progress',
          'paused',
          'finished',
          'abandoned'
        )),
      priority_rank INTEGER NOT NULL DEFAULT 0 CHECK (priority_rank >= 0),
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT
    ) STRICT;

    CREATE INDEX library_games_sort_index
      ON library_games (archived_at, priority_rank, sort_title);

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
      sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE INDEX collections_sort_index
      ON collections (sort_order, name);

    CREATE TABLE collection_games (
      collection_id TEXT NOT NULL
        REFERENCES collections(id) ON DELETE CASCADE,
      game_id TEXT NOT NULL
        REFERENCES library_games(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
      added_at TEXT NOT NULL,
      PRIMARY KEY (collection_id, game_id)
    ) STRICT;

    CREATE INDEX collection_games_sort_index
      ON collection_games (collection_id, sort_order);

    CREATE TABLE saved_views (
      id TEXT PRIMARY KEY,
      builtin_key TEXT UNIQUE,
      name TEXT NOT NULL CHECK (length(trim(name)) > 0),
      filters_json TEXT NOT NULL CHECK (json_valid(filters_json)),
      sort_json TEXT NOT NULL CHECK (json_valid(sort_json)),
      sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
      is_builtin INTEGER NOT NULL DEFAULT 0
        CHECK (is_builtin IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK (
        (is_builtin = 1 AND builtin_key IS NOT NULL) OR
        (is_builtin = 0 AND builtin_key IS NULL)
      )
    ) STRICT;

    CREATE INDEX saved_views_sort_index
      ON saved_views (sort_order, name);

    CREATE TABLE trophy_sync_runs (
      id TEXT PRIMARY KEY,
      target_account_id TEXT NOT NULL,
      status TEXT NOT NULL
        CHECK (status IN ('running', 'succeeded', 'partial', 'failed')),
      request_count INTEGER NOT NULL DEFAULT 0
        CHECK (request_count >= 0),
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
        CHECK (payload_json IS NULL OR json_valid(payload_json)),
      UNIQUE (game_id, captured_at)
    ) STRICT;

    CREATE INDEX trophy_snapshots_game_index
      ON trophy_snapshots (game_id, captured_at DESC);

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
      ON trophy_alerts (status, created_at DESC);

    CREATE TABLE app_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL CHECK (json_valid(value_json)),
      updated_at TEXT NOT NULL
    ) STRICT;

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
        'pursuing_soon',
        'Pursuing soon',
        '{"pursuitStatuses":["pursuing_soon"]}',
        '{"field":"priorityRank","direction":"asc"}',
        10,
        1,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      ),
      (
        'builtin-in-progress',
        'in_progress',
        'In progress',
        '{"pursuitStatuses":["in_progress"]}',
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
      );
  `,
};
