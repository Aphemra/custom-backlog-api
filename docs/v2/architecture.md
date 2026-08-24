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
      +-- SQLite repository
      +-- backup and restore service
      +-- PlayStation read adapter
      +-- metadata provider adapter
```

## Storage

SQLite is the canonical store. The API uses the SQLite implementation bundled
with Node.js 24, avoiding a separate database server and third-party native
database dependency.

Browser localStorage may be used only for disposable interface preferences,
such as whether a panel is collapsed. It must not be the only home of library,
collection, trophy, synchronization, or backup data.

Database changes must use numbered migrations. Applied migrations are recorded
with a checksum. An applied migration must never be edited; schema changes are
made by adding the next numbered migration.

Migrations and application startup must never silently discard incompatible
data. Automatic backups should be written before risky migrations and imports.

## Planned API feature layout

```text
apps/api/src/
  config/
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
