import type { Migration } from "../migration.js";

export const savedViewPlayStatusMigration: Migration = {
  version: 4,
  name: "saved_view_play_status",
  sql: `
    UPDATE saved_views
    SET filters_json = json_set(
      json_remove(filters_json, '$.pursuitStatuses'),
      '$.playStatuses',
      json(
        (
          SELECT json_group_array(mapped_status)
          FROM (
            SELECT DISTINCT
              CASE legacy_status.value
                WHEN 'unplanned' THEN 'not_started'
                WHEN 'pursuing_soon' THEN 'not_started'
                WHEN 'in_progress' THEN 'playing'
                WHEN 'paused' THEN 'on_hold'
                WHEN 'finished' THEN 'completed'
                WHEN 'abandoned' THEN 'on_hold'
                ELSE 'not_started'
              END AS mapped_status
            FROM json_each(
              saved_views.filters_json,
              '$.pursuitStatuses'
            ) AS legacy_status
          )
        )
      )
    )
    WHERE json_type(filters_json, '$.pursuitStatuses') = 'array';

    UPDATE saved_views
    SET filters_json = json_set(
      json_remove(filters_json, '$.archiveMode'),
      '$.hiddenMode',
      CASE json_extract(filters_json, '$.archiveMode')
        WHEN 'archived' THEN 'hidden'
        WHEN 'all' THEN 'all'
        ELSE 'visible'
      END
    )
    WHERE json_type(filters_json, '$.archiveMode') = 'text';

    UPDATE saved_views
    SET sort_json = json_set(
      sort_json,
      '$.field',
      'playStatus'
    )
    WHERE json_extract(sort_json, '$.field') = 'pursuitStatus';

    UPDATE saved_views
    SET
      builtin_key = 'not_started',
      name = 'Not started',
      filters_json = '{"playStatuses":["not_started"]}',
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 'builtin-pursuing-soon';

    UPDATE saved_views
    SET
      builtin_key = 'playing',
      name = 'Playing',
      filters_json = '{"playStatuses":["playing"]}',
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 'builtin-in-progress';
  `,
};
