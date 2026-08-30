# Local API Reference

## Base addresses

Development:

```text
http://127.0.0.1:3001/api
```

Production:

```text
http://127.0.0.1:47831/api
```

The browser normally uses relative `/api` URLs. Vite proxies them during development; Express handles them directly in production.

## Security boundary

The API has no user authentication. Startup accepts only `127.0.0.1` or `localhost` as the bind host.

Do not expose this API with router port forwarding, a public reverse proxy, or Tailscale Funnel. Private Tailscale Serve access relies on tailnet identity and policy outside the application.

## Conventions

- JSON request bodies are limited to 25 MB.
- Important mutation parsers reject unknown fields.
- IDs are opaque strings unless a provider-specific numeric ID is explicitly documented.
- Timestamps are ISO 8601 strings.
- Empty successful deletions return `204 No Content`.
- Creation routes generally return `201 Created` and a `Location` header.
- Complete-order routes require every relevant ID exactly once.
- Provider-triggering PlayStation actions and IGDB enrichment/refresh require an explicit action header.

Stable error shape:

```json
{
  "ok": false,
  "error": "stable_error_code",
  "message": "Human-readable explanation.",
  "details": {}
}
```

`message` and `details` are present when relevant. Invalid JSON returns:

```json
{
  "ok": false,
  "error": "invalid_json"
}
```

Unknown `/api` paths return `404` with `api_route_not_found`.

## Health and database

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Service version and database migration status. |
| `GET` | `/database/status` | Database schema and available-migration status. |
| `POST` | `/database/backups` | Create a timestamped native SQLite backup. |

## Images

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/images/:imageId` | Serve an opaque cached image reference. |

The image route serves valid local content first. Missing files may be downloaded from their recorded provider URL. Stale files are served while revalidation runs in the background.

## Library

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/library/games` | List Library games, resources, and view data. |
| `PUT` | `/library/games/order` | Replace complete visible manual Library order. |
| `GET` | `/library/games/:gameId` | Read one Library game. |
| `GET` | `/library/games/:gameId/details` | Compose stored Library, IGDB, image, and PlayStation details. |
| `PATCH` | `/library/games/:gameId` | Update title, platform, Play Status, unobtainable state, or notes. |
| `POST` | `/library/games/:gameId/hide` | Hide a game. |
| `POST` | `/library/games/:gameId/unhide` | Restore a hidden game. |
| `DELETE` | `/library/games/:gameId` | Permanently delete a game and owned records. |

`GET /library/games` accepts:

| Query | Values | Default |
| --- | --- | --- |
| `includeHidden` | `true`, `false` | `false` |

Ordering body:

```json
{
  "orderedGameIds": ["game-id-1", "game-id-2"]
}
```

Supported platforms:

```text
PS3, PS4, PS5
```

Supported Play Status values:

```text
unreleased, not_started, playing, on_hold, waiting, completed
```

### Game resources

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/library/games/:gameId/resources` | List useful links for a game. |
| `POST` | `/library/games/:gameId/resources` | Create a useful link. |
| `PUT` | `/library/games/:gameId/resources/order` | Replace complete resource order. |
| `PATCH` | `/library/games/:gameId/resources/:resourceId` | Update a resource. |
| `DELETE` | `/library/games/:gameId/resources/:resourceId` | Delete a resource. |

Resource types:

```text
trophy_page, guide, interactive_map
```

Provider is derived from the URL when recognized:

```text
psnprofiles, powerpyx, mapgenie, other
```

Only safe HTTPS URLs are accepted.

## Collections

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/collections` | List ordered Collection summaries. |
| `PUT` | `/collections/order` | Replace complete Collection order. |
| `PUT` | `/collections/pinned` | Pin one Collection or clear the pin. |
| `POST` | `/collections` | Create a Collection. |
| `PUT` | `/collections/memberships/:gameId` | Replace every Collection membership for one game. |
| `GET` | `/collections/:collectionId` | Read a Collection with ordered games. |
| `PATCH` | `/collections/:collectionId` | Update name or description. |
| `PUT` | `/collections/:collectionId/games` | Replace membership and order for one Collection. |
| `DELETE` | `/collections/:collectionId` | Permanently delete a Collection. |

Pin body:

```json
{
  "collectionId": "collection-id-or-null"
}
```

Only one Collection may be pinned. A Collection referenced by a Saved View cannot be deleted until that dependency is removed.

## Saved Views

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/saved-views` | List built-in and custom views. |
| `PUT` | `/saved-views/order` | Replace complete view order. |
| `POST` | `/saved-views` | Create a custom view. |
| `GET` | `/saved-views/:viewId/games` | Evaluate one view on the API. |
| `PATCH` | `/saved-views/:viewId` | Update a custom view. |
| `DELETE` | `/saved-views/:viewId` | Delete a custom view. |

Built-in views cannot be edited or deleted.

`GET /saved-views/:viewId/games` accepts an optional `search` string up to 200 characters.

View filters may include:

- search text
- platforms
- Play Status values
- hidden mode: `visible`, `hidden`, or `all`
- Collection IDs
- platinum-earned state
- 100%-complete state
- needs-sync state
- alert kinds
- alert status

Sort fields:

```text
priorityRank
title
platform
playStatus
createdAt
updatedAt
progressPercent
lastSyncedAt
alertCreatedAt
```

Sort direction is `asc` or `desc`.

## IGDB

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/integrations/igdb/games` | Search supported PlayStation results. |
| `POST` | `/integrations/igdb/games/:externalId/library` | Add an IGDB result as a new Library game. |
| `POST` | `/integrations/igdb/games/:externalId/library/:gameId/metadata` | Attach selected IGDB metadata to an existing game. |
| `POST` | `/integrations/igdb/library/:gameId/metadata-refresh` | Refresh the game's currently linked IGDB metadata. |

Search query parameters:

| Query | Values | Default |
| --- | --- | --- |
| `query` | Normalized search string, 2–100 characters | required |
| `platform` | `all`, `PS3`, `PS4`, `PS5` | `all` |
| `scope` | `games`, `editions`, `dlc`, `expansions`, `packs`, `updates`, `all` | `games` |

Add body:

```json
{
  "platform": "PS5",
  "playStatus": "not_started"
}
```

`playStatus` is optional and defaults to `not_started`, subject to service-side Unreleased initialization from stored release data.

Required explicit action headers:

| Path | `x-trophy-backlog-action` |
| --- | --- |
| `POST .../library/:gameId/metadata` | `enrich-library-game-from-igdb` |
| `POST .../metadata-refresh` | `refresh-library-game-from-igdb` |

## PlayStation

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/integrations/playstation/status` | Report whether credentials are configured and identify the reader/target IDs. |
| `GET` | `/integrations/playstation/sync-progress` | Read current/last process-local sync progress. |
| `GET` | `/integrations/playstation/profile-progression` | Read latest stored profile progression. |
| `GET` | `/integrations/playstation/games/:gameId/trophies` | Read the complete locally cached trophy set. |
| `PATCH` | `/integrations/playstation/games/:gameId/trophies/:trophyId/availability` | Set or clear a local unobtainable override. |
| `POST` | `/integrations/playstation/connection-tests` | Authenticate the reader and resolve target profile summary. |
| `POST` | `/integrations/playstation/title-previews` | Fetch, filter, reconcile, and cache target trophy-title previews. |
| `POST` | `/integrations/playstation/title-links` | Link a previewed PSN title to an existing Library game. |
| `POST` | `/integrations/playstation/title-imports` | Create and link a Library game from a previewed PSN title. |
| `POST` | `/integrations/playstation/progress-syncs` | Synchronize detailed trophies and snapshots for linked games only. |
| `POST` | `/integrations/playstation/syncs` | Run full preview/reconciliation, linked trophy sync, alerts/profile update, and IGDB refresh. |

Availability body:

```json
{
  "unobtainable": true,
  "reason": "Closed servers"
}
```

`reason` is optional, normalized to `null` when blank, and limited to 500 characters. Clearing `unobtainable` also clears the reason.

Required explicit action headers:

| Operation | `x-trophy-backlog-action` |
| --- | --- |
| Connection test | `test-playstation-connection` |
| Title preview | `preview-playstation-titles` |
| Title link | `link-playstation-title` |
| Title import | `import-playstation-title` |
| Progress sync | `synchronize-playstation-trophy-progress` |
| Full sync | `synchronize-playstation-trophies` |

Only one synchronization may run at once. A second attempt returns `409 playstation_sync_in_progress`. A configured cooldown can return `429 playstation_sync_cooldown_active` with `retryAfterSeconds` and `nextAllowedAt` details.

## Settings

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/settings` | Read synchronization, notification, and appearance settings. |
| `PATCH` | `/settings` | Partially update application settings. |
| `GET` | `/settings/playstation` | Read a redacted PlayStation credential summary. |
| `PATCH` | `/settings/playstation` | Partially update locally stored PlayStation credentials/reminder. |

Application settings:

- `trophySyncCooldownEnabled`
- `trophySyncCooldownSeconds` from 1 through 86,400
- `notificationDurationSeconds` from 1 through 60
- accent color
- one color for each Play Status
- unobtainable color

PlayStation credential update fields:

- `readerOnlineId`
- `targetOnlineId`
- `readerNpsso` as exactly 64 characters or `null`
- `renewalReminderDays` from 1 through 30

Online IDs are trimmed strings from 3 through 16 characters, and the reader
and target IDs must differ.

The GET response never contains `readerNpsso`. It returns `hasNpsso`, entry/expected-renewal timestamps, and reminder lead time.

## Trophy alerts

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/trophy-alerts` | List alerts with optional kind/status filters. |
| `GET` | `/trophy-alerts/summary` | Count total and unread alerts. |
| `GET` | `/trophy-alerts/:alertId` | Read one alert. |
| `PATCH` | `/trophy-alerts/:alertId` | Change only alert status. |

Kinds:

```text
new_trophies, completion_lost
```

Statuses:

```text
unread, read, resolved, dismissed
```

List filters use `kind` and `status` query parameters.

Status update body:

```json
{
  "status": "read"
}
```

## History

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/history/overview` | Summary, coverage, latest earned trophy, and latest milestone. |
| `GET` | `/history/statistics` | Platform/grade totals and monthly activity. |
| `GET` | `/history/trophies` | Paginated earned-trophy log with cumulative progression. |
| `GET` | `/history/milestones` | Calculated trophy, platinum, and level milestones. |
| `GET` | `/history/backlog` | Paginated local backlog-action history. |

### Trophy log query

| Query | Purpose |
| --- | --- |
| `search` | Search game/trophy text. |
| `platform` | `PS3`, `PS4`, or `PS5`. |
| `trophyType` | `bronze`, `silver`, `gold`, or `platinum`. |
| `gameId` | Restrict to one Library game. |
| `earnedFrom` | Inclusive parsable date/timestamp. |
| `earnedTo` | Inclusive parsable date/timestamp. |
| `direction` | `asc` or `desc`; default `desc`. |
| `page` | Whole number; default `1`. |
| `pageSize` | 1–100; default `50`. |

### Milestone query

| Query | Values |
| --- | --- |
| `kind` | `trophy_total`, `platinum_total`, `trophy_level` |
| `direction` | `asc`, `desc` |

### Backlog history query

| Query | Purpose |
| --- | --- |
| `action` | Restrict to one supported backlog action. |
| `source` | `user`, `playstation_sync`, `portable_import`, or `system`. |
| `gameId` | Restrict to one game. |
| `collectionId` | Restrict to one Collection. |
| `occurredFrom` | Inclusive parsable date/timestamp. |
| `occurredTo` | Inclusive parsable date/timestamp. |
| `direction` | `asc` or `desc`; default `desc`. |
| `page` | Whole number; default `1`. |
| `pageSize` | 1–100; default `50`. |

## Portable data and maintenance

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/data/export` | Download current portable JSON format v5. |
| `POST` | `/data/imports/preview` | Validate and compare a format-v5 export without mutation. |
| `POST` | `/data/imports` | Back up SQLite, then transactionally replace portable data. |
| `DELETE` | `/data/backlog` | Back up SQLite, then delete backlog-owned data after exact confirmation. |

Portable import accepts only format version 5. Unknown versions and broken references are rejected before replacement.

Delete Entire Backlog requires the validation contract's exact confirmation phrase:

```text
Delete Entire Backlog
```

See [Production and recovery](production.md) for what portable JSON and SQLite backups do and do not contain.
