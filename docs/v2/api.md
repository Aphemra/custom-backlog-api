# Current API Reference

This file documents the API implemented at the Checkpoint 1 baseline. Planned endpoints and contract changes belong in [roadmap.md](roadmap.md) until implemented.

Base URL: `http://127.0.0.1:3001/api`

## Conventions

- Request and response bodies are JSON unless an endpoint returns an image or download.
- Error responses use a stable `error` code and may include a human-readable `message`.
- Unknown `/api` routes return `404` with `api_route_not_found`.
- Integration actions listed below require the exact `x-trophy-backlog-action` header.
- Dates are ISO 8601 strings.
- Current game platforms are `PS3`, `PS4`, and `PS5`.
- Current Pursuit Status values are `unplanned`, `pursuing_soon`, `in_progress`, `paused`, `finished`, and `abandoned`. These will be migrated in Checkpoint 2.

## Health and database

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Service version and database status. |
| `GET` | `/database/status` | Database path/status and applied migration information. |
| `POST` | `/database/backups` | Create a timestamped local SQLite backup. |

## Library

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/library/games` | List active games. Add `?includeArchived=true` to include hidden/archived games. |
| `GET` | `/library/games/:gameId` | Fetch one game. |
| `POST` | `/library/games` | Create a manual game using `title`, `platform`, optional `pursuitStatus`, and optional `notes`. This route is scheduled for removal from the final UI. |
| `PATCH` | `/library/games/:gameId` | Update supplied mutable fields. |
| `PUT` | `/library/games/order` | Replace active Library order with `{ "orderedGameIds": [...] }`. Every active game must appear exactly once. |
| `POST` | `/library/games/:gameId/archive` | Hide/archive a game. |
| `POST` | `/library/games/:gameId/restore` | Restore a hidden/archived game. |
| `DELETE` | `/library/games/:gameId` | Permanently delete a game and dependent data. |

Library responses include the latest trophy summary and preferred cached artwork when available.

## Collections

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/collections` | List Collection summaries in order. |
| `POST` | `/collections` | Create a Collection with `name` and optional `description`. |
| `GET` | `/collections/:collectionId` | Fetch a Collection and ordered games. |
| `PATCH` | `/collections/:collectionId` | Update name and/or description. |
| `PUT` | `/collections/order` | Replace Collection order with `{ "orderedCollectionIds": [...] }`. |
| `PUT` | `/collections/:collectionId/games` | Replace membership/order with `{ "orderedGameIds": [...] }`. |
| `DELETE` | `/collections/:collectionId` | Permanently delete a Collection. Rejected while a Saved View references it. |

## Saved Views

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/saved-views` | List built-in and custom views. |
| `POST` | `/saved-views` | Create a custom view. |
| `PUT` | `/saved-views/order` | Replace complete view order with `{ "orderedViewIds": [...] }`. |
| `GET` | `/saved-views/:viewId/games` | Return the view and matching games. Optional `?search=` further narrows titles. |
| `PATCH` | `/saved-views/:viewId` | Update a custom view. Built-ins are immutable. |
| `DELETE` | `/saved-views/:viewId` | Delete a custom view. Built-ins cannot be deleted. |

Filters currently support search, platforms, Pursuit Statuses, active/archived/all, Collection IDs, platinum earned, 100% state, needs-sync state, alert kinds, and alert status. Sort fields include manual priority, title, platform, status, created/updated time, progress, last sync, and alert creation time.

## IGDB

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/integrations/igdb/games?query=...` | Search normalized IGDB titles. `includeDlc=true` and `includeEditions=true` are optional. |
| `POST` | `/integrations/igdb/games/:externalId/library` | Import an IGDB game into the Library. Body requires `platform` and optionally `pursuitStatus`. |
| `POST` | `/integrations/igdb/games/:externalId/library/:gameId/metadata` | Enrich an existing Library game from IGDB. |

Metadata enrichment requires:

```text
x-trophy-backlog-action: enrich-library-game-from-igdb
```

Search requires between 2 and 100 normalized characters. The current normalization handles known symbols, full-width title characters, and trailing trophy-list wording.

## PlayStation

| Method | Path | Purpose | Required action header value |
| --- | --- | --- | --- |
| `GET` | `/integrations/playstation/status` | Report whether reader and target credentials are configured. | None |
| `POST` | `/integrations/playstation/connection-tests` | Resolve reader/target identities and target trophy summary. | `test-playstation-connection` |
| `POST` | `/integrations/playstation/title-previews` | Fetch supported trophy titles, reconcile them with the Library, cache icons, and remember preview data. | `preview-playstation-titles` |
| `POST` | `/integrations/playstation/title-links` | Link a previewed PSN title to an existing Library game. | `link-playstation-title` |
| `POST` | `/integrations/playstation/title-imports` | Create a Library game from a previewed PSN title and link it. | `import-playstation-title` |
| `POST` | `/integrations/playstation/syncs` | Refresh preview/reconciliation and create snapshots/alerts for linked titles. | `synchronize-playstation-trophies` |

Title-link body:

```json
{
  "gameId": "library-game-id",
  "npServiceName": "trophy2",
  "npCommunicationId": "NPWR00000_00"
}
```

Title-import body adds `platform` and optional `pursuitStatus`. The current full sync returns both `synchronization` and refreshed `preview` data. Reconciliation states are `linked`, `suggested_match`, `ambiguous`, and `new`.

The current synchronization stores title-level counts/progress only. Full individual trophy records and the Library-only fast-sync contract are planned, not yet part of this API.

## Trophy alerts

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/trophy-alerts` | List alerts. Optional `kind` and `status` filters. |
| `GET` | `/trophy-alerts/summary` | Return total and unread counts. |
| `GET` | `/trophy-alerts/:alertId` | Fetch one alert. |
| `PATCH` | `/trophy-alerts/:alertId` | Replace only its `status`. |

Kinds are `new_trophies` and `completion_lost`. Statuses are `unread`, `read`, `resolved`, and `dismissed`.

## Cached images

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/images/:imageId` | Serve a locally cached image, refreshing a missing file from its recorded source when possible. |

Image IDs are opaque. Responses use the cached content type and `Cache-Control: private, max-age=3600`.

## Portable data

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/data/export` | Download current portable JSON format v3. |
| `POST` | `/data/imports/preview` | Validate an export and compare incoming/current record counts without changing data. |
| `POST` | `/data/imports` | Back up SQLite, then replace supported data transactionally. |

The reader accepts format versions 1 through 3. It rejects an older import when replacement would discard integration data that the older format cannot represent.

Format v3 contains Library games, Collections/membership order, Saved Views, PSN links, external metadata and links, trophy snapshots, alerts, cached-image records, and Library image links. Cached binary files are not embedded in the JSON.
