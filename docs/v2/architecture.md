# V2 architecture

## Overview

Trophy Backlog is a local application with two workspace packages:

- `apps/web`: the React user interface
- `apps/api`: the local API, persistence layer, and external-service adapters

The browser communicates only with the local API. External credentials and
external-service requests must never be placed in browser code.

## Data flow

```text
React interface
      |
      | /api
      v
Local Express API
      |
      +-- SQLite repositories
      +-- backup and restore services
      +-- PlayStation read adapter (planned)
      +-- metadata provider adapter (planned)
```

## Storage

SQLite is the canonical store. The API uses the SQLite implementation bundled
with Node.js 24, avoiding a separate database server and third-party native
database dependency.

Browser localStorage may be used only for disposable interface preferences,
such as whether a panel is collapsed. It must not be the only home of library,
collection, trophy, synchronization, alert, or backup data.

The default database location is:

```text
apps/api/runtime/trophy-backlog.sqlite
```

The data directory can be changed with `BACKLOG_DATA_DIRECTORY`. Relative paths
are resolved from `apps/api`.

## Migrations

Database changes use numbered migrations. Applied migrations are recorded with
a SHA-256 checksum.

An applied migration must never be edited. Every later schema change must be a
new migration with the next version number.

Each migration runs inside a transaction. A failed migration is rolled back
rather than leaving a partially updated schema.

Risky future migrations and imports must create a backup before modifying the
canonical database.

## Current API structure

```text
apps/api/src/
  config/
    runtimeConfig.ts
  database/
    migrations/
    database.ts
    getDatabaseStatus.ts
    migration.ts
    runMigrations.ts
  errors/
    httpError.ts
  features/
    backups/
    library/
  routes/
    databaseRoutes.ts
    healthRoutes.ts
    libraryRoutes.ts
  app.ts
  index.ts
```

Tests live beside the code they exercise.

## Planned API feature structure

```text
apps/api/src/
  database/
    migrations/
    repositories/
  features/
    backups/
    collections/
    library/
    metadata/
    savedViews/
    trophyAlerts/
    trophySync/
  integrations/
    igdb/
    playstation/
  routes/
```

Directories should be created when their first real implementation is added,
rather than committed empty.

## Planned web feature structure

```text
apps/web/src/
  app/
  components/
  features/
    alerts/
    collections/
    importExport/
    library/
    settings/
  services/
    api/
  styles/
```

## Domain rules

- A library game exists once.
- Separate platform versions or trophy stacks may be separate library games.
- Collections reference library games; they do not duplicate them.
- Saved views store query rules; they do not duplicate games.
- External metadata is replaceable data, not the identity of a library game.
- PlayStation trophy identifiers are separate from metadata-provider
  identifiers.
- Trophy history is append-oriented so changes can be explained.
- Manual user fields are never overwritten by synchronization.
- Imports and synchronization must be repeatable without creating accidental
  duplicates.
- Archiving is the normal non-destructive removal operation.
- Permanent deletion requires explicit user confirmation in the interface.

## Library ordering

Active games have integer priority ranks. Reordering supplies every active game
ID exactly once and updates the ranks inside one transaction.

Archived games are excluded from the active order. Restored games return at the
bottom of the active library.

This full-list rule prevents a filtered or stale interface from accidentally
removing unseen games from the order.

## Backups and portable exports

SQLite backups are internal safety copies created with SQLite's backup API.
They are stored under `apps/api/runtime/backups/` by default.

Portable JSON export/import is a separate future feature. It will provide a
human-accessible file format for moving or restoring personal data without
requiring direct SQLite access.

## Frontend design direction

The primary layout target is a portrait-oriented desktop display.

Rows and cards should expose only the information needed for decisions:
artwork, title, platform, pursuit status, trophy completion, platinum state,
alerts, collections, and priority.

Additional metadata belongs in expandable details or an editing surface.
