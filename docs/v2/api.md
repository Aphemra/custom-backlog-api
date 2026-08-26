# V2 local API

## Overview

The API is available only on the local computer under `/api`.

Successful endpoints return JSON except permanent deletion, which returns an
empty `204 No Content` response.

Expected client errors use this shape:

```json
{
  "ok": false,
  "error": "machine_readable_code",
  "message": "Human-readable explanation."
}
```

Unexpected internal errors return:

```json
{
  "ok": false,
  "error": "internal_error"
}
```

## System endpoints

### Health check

```http
GET /api/health
```

Reports API availability and the current database migration version.

### Database status

```http
GET /api/database/status
```

Returns the applied schema version and available migration count.

### Create a SQLite backup

```http
POST /api/database/backups
```

Creates a restorable SQLite backup under `apps/api/runtime/backups/` and
returns its filename and creation time.

## Library game representation

A library game uses this shape:

```json
{
  "id": "generated-uuid",
  "title": "Astro Bot",
  "sortTitle": "astro bot",
  "platform": "PS5",
  "pursuitStatus": "pursuing_soon",
  "priorityRank": 1000,
  "notes": null,
  "createdAt": "2026-08-25T12:00:00.000Z",
  "updatedAt": "2026-08-25T12:00:00.000Z",
  "archivedAt": null
}
```

Supported platforms:

- `PS3`
- `PS4`
- `PS5`

Supported pursuit statuses:

- `unplanned`
- `pursuing_soon`
- `in_progress`
- `paused`
- `finished`
- `abandoned`

## Library endpoints

### List active games

```http
GET /api/library/games
```

Response:

```json
{
  "games": []
}
```

Use the following query to include archived games:

```http
GET /api/library/games?includeArchived=true
```

### Get one game

```http
GET /api/library/games/:gameId
```

Response:

```json
{
  "game": {}
}
```

### Add a game

```http
POST /api/library/games
Content-Type: application/json

{
  "title": "Astro Bot",
  "platform": "PS5",
  "pursuitStatus": "pursuing_soon",
  "notes": "Optional personal notes"
}
```

Only `title` and `platform` are required. New games receive the `unplanned`
status when `pursuitStatus` is omitted.

The endpoint returns `201 Created` and a `{ "game": ... }` response.

### Edit a game

```http
PATCH /api/library/games/:gameId
Content-Type: application/json

{
  "pursuitStatus": "in_progress"
}
```

Editable fields:

- `title`
- `platform`
- `pursuitStatus`
- `notes`

At least one field is required. Unknown fields are rejected.

Set `notes` to `null` or an empty string to clear the notes.

### Reorder active games

```http
PUT /api/library/games/order
Content-Type: application/json

{
  "orderedGameIds": [
    "game-id-3",
    "game-id-1",
    "game-id-2"
  ]
}
```

The array must contain every active game exactly once. Archived games are not
included.

The endpoint returns the newly ordered active library.

### Archive a game

```http
POST /api/library/games/:gameId/archive
```

Archiving is the normal removal operation. It hides the game from the active
library while preserving collections, metadata, trophy snapshots, and alerts.

Archiving an already archived game is safe and returns its existing state.

### Restore a game

```http
POST /api/library/games/:gameId/restore
```

The restored game is placed at the bottom of the active library.

Restoring an already active game is safe and returns its existing state.

### Permanently delete a game

```http
DELETE /api/library/games/:gameId
```

Returns `204 No Content` when successful.

Permanent deletion cascades through associated local records and cannot be
undone without restoring a backup. The user interface must require explicit
confirmation before calling this endpoint.

## Collection representations

A collection summary includes its manually controlled order and game counts:

```json
{
  "id": "generated-uuid",
  "name": "Resident Evil",
  "description": "Mainline games and remakes",
  "sortOrder": 1000,
  "gameCount": 3,
  "activeGameCount": 2,
  "archivedGameCount": 1,
  "createdAt": "2026-08-25T12:00:00.000Z",
  "updatedAt": "2026-08-25T12:00:00.000Z"
}
```

A collection detail has the same fields plus an ordered `games` array. Each
entry contains the normal library-game fields plus `collectionSortOrder` and
`addedAt`.

## Collection endpoints

### List collections

```http
GET /api/collections
```

Returns `{ "collections": [] }` in manual collection order. Each entry is a
collection summary and does not include its full game list.

### Get one collection

```http
GET /api/collections/:collectionId
```

Returns `{ "collection": ... }` with its games in manual collection order.
Archived library games remain visible in a collection and have a non-null
`archivedAt` value.

### Create a collection

```http
POST /api/collections
Content-Type: application/json

{
  "name": "Resident Evil",
  "description": "Optional description"
}
```

Only `name` is required. The new collection is placed at the bottom of the
collection list. The endpoint returns `201 Created`.

### Edit a collection

```http
PATCH /api/collections/:collectionId
Content-Type: application/json

{
  "name": "Resident Evil Series",
  "description": null
}
```

At least one field is required. Set `description` to `null` or an empty string
to clear it.

### Reorder collections

```http
PUT /api/collections/order
Content-Type: application/json

{
  "orderedCollectionIds": [
    "collection-id-2",
    "collection-id-1"
  ]
}
```

The array must contain every collection exactly once. The update is atomic and
returns the newly ordered summaries.

### Replace a collection's ordered games

```http
PUT /api/collections/:collectionId/games
Content-Type: application/json

{
  "orderedGameIds": [
    "game-id-3",
    "game-id-1"
  ]
}
```

This endpoint replaces the collection's complete membership and order in one
atomic operation. Every ID must identify an existing library game. Both active
and archived games are accepted. Send an empty array to empty the collection.

The endpoint is intentionally idempotent: sending the same complete list again
produces the same membership and order.

### Permanently delete a collection

```http
DELETE /api/collections/:collectionId
```

Returns `204 No Content`. This deletes the collection and its membership rows,
but never deletes library games. The future interface must require explicit
confirmation.

## Portable data endpoints

Portable data is a versioned JSON representation of the canonical library and
Collections. Version one includes archived games and manual ordering.

### Export portable data

```http
GET /api/data/export
```

Returns a JSON attachment using this top-level shape:

```json
{
  "format": "trophy-backlog-portable-data",
  "formatVersion": 1,
  "exportedAt": "2026-08-25T12:00:00.000Z",
  "data": {
    "libraryGames": [],
    "collections": []
  }
}
```

Each library entry preserves its ID, manual fields, priority rank, timestamps,
and archive state. Each Collection preserves its ID, fields, order, timestamps,
and complete ordered game-ID list.

### Preview an import

```http
POST /api/data/imports/preview
Content-Type: application/json

{
  "format": "trophy-backlog-portable-data",
  "formatVersion": 1,
  "exportedAt": "2026-08-25T12:00:00.000Z",
  "data": {
    "libraryGames": [],
    "collections": []
  }
}
```

The complete export is validated. A successful response reports the incoming
and current library-game, Collection, and membership counts. It does not change
the database.

Unknown fields, duplicate IDs, invalid values, unsupported versions, broken
Collection references, and excessively large arrays are rejected.

### Apply an import

```http
POST /api/data/imports
Content-Type: application/json

{
  "format": "trophy-backlog-portable-data",
  "formatVersion": 1,
  "exportedAt": "2026-08-25T12:00:00.000Z",
  "data": {
    "libraryGames": [],
    "collections": []
  }
}
```

The document is validated again. The API then creates a SQLite backup and
atomically replaces the library, Collections, and Collection memberships.

The response includes the preview counts, import time, and created SQLite
backup filename.

Version one refuses to import when existing metadata links or trophy records
are present because it cannot preserve those future data types. This is a
deliberate data-loss guard rather than an import error to work around.
