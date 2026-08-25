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
