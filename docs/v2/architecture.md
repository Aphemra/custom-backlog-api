# Version 2 Architecture

## Overview

Trophy Backlog is a local monorepo with two applications:

```text
Browser (React/Vite, 127.0.0.1:5173)
        |
        | /api through the Vite development proxy
        v
Local API (Express, 127.0.0.1:3001)
        |
        +-- SQLite database
        +-- local backups
        +-- local image cache
        +-- IGDB/Twitch API
        +-- PlayStation API through psn-api
```

The browser never receives IGDB secrets or the PlayStation NPSSO. External integration calls originate in the API.

## Repository layout

```text
apps/
  api/                 Express API, SQLite access, integrations, tests
  web/                 React and Vite user interface
docs/v2/               product and engineering documentation
package.json           workspace scripts
```

Within `apps/api/src`, routes validate HTTP input and delegate to feature services or repositories. Database migrations own schema evolution. Integration clients are isolated behind services so stored records and Library behavior do not depend directly on live provider responses.

Within `apps/web/src`, feature-specific API clients and components support the current page-based interface. The roadmap consolidates Saved Views, search, import/export, and details into the Library while retaining feature boundaries underneath.

## Runtime boundaries

### API binding

`BACKLOG_HOST` accepts only `127.0.0.1` or `localhost`. The default port is `3001`. This local-only check is an intentional security boundary, not merely a default.

### Runtime storage

`BACKLOG_DATA_DIRECTORY` defaults to `apps/api/runtime` and contains:

- `trophy-backlog.sqlite`
- `backups/`
- `images/`

Database data is authoritative. Cached image files are replaceable provider cache entries.

### Credentials

IGDB and PlayStation credentials are read from the API environment. They are not stored in portable exports, returned by status endpoints, or exposed to the browser.

## Data model

The current schema contains these main domains:

- **Library:** games, platform, current Pursuit Status, manual priority, notes, and hidden/archive timestamp.
- **Collections:** ordered Collections and ordered game membership.
- **Saved Views:** built-in and custom filter/sort definitions.
- **Metadata:** provider records and links from Library games to IGDB records.
- **PlayStation links:** PSN service name and communication ID linked to a Library game.
- **Trophy synchronization:** sync runs and title-level trophy snapshots.
- **Alerts:** new-trophy and completion-lost records with lifecycle status.
- **Images:** provider source records and ordered roles linked to Library games.
- **Settings:** a schema location exists; typed user settings are scheduled for Checkpoint 3.

Checkpoint 2 migrates Pursuit Status to Play Status and separates `unobtainable` from play state. Later migrations add full trophy groups/trophies, profile snapshots, game resources, and richer normalized metadata where querying or durability requires it. Provider payloads may also be retained for forward compatibility, but user-visible behavior must not depend on undocumented JSON shapes alone.

## Integration design

### IGDB

The API obtains an app access token from Twitch, searches IGDB, stores provider metadata, and caches selected images. Search normalization strips known noise before querying. DLC and edition inclusion are explicit options.

IGDB is the source of truth for games added outside PSN import. A provider outage must not prevent already-imported Library games and cached art from loading.

### PlayStation

The integration uses `psn-api` with a dedicated reader account's NPSSO. It resolves the reader and target identities, previews target trophy titles, reconciles them with the Library, and stores explicit links before synchronization.

All PlayStation calls share a serialized request gate. Sync retries use a bounded budget. The future Library fast-sync path will operate only on existing links, enforce a configurable cooldown and in-flight lock, and avoid IGDB work or automatic Library creation.

### Image cache

Provider image references are stored in SQLite. Binary files are served by opaque image IDs through `/api/images/:imageId`. Missing local files are refreshed from the recorded provider URL where possible. Paths are resolved inside the configured cache directory to prevent traversal.

## API conventions

- JSON request bodies are limited to 25 MB.
- Validation rejects unknown fields for important mutation contracts.
- Errors use `{ "ok": false, "error": "stable_code", "message": "..." }` when a message is available.
- Destructive replacement imports have a preview operation and create a SQLite backup before mutation.
- External integration mutations require an explicit `x-trophy-backlog-action` header.
- Ordering endpoints require a complete, duplicate-free set rather than silently accepting partial order changes.

See [api.md](api.md) for the current endpoint inventory.

## Backup and portability

Portable format v3 includes Library games, Collections and memberships, Saved Views, PlayStation links, IGDB/provider metadata links, trophy snapshots, trophy alerts, cached-image records, and Library image links. Versions 1 through 3 can be read, with safety checks that reject an older import when it would discard newer integration data.

Image binaries are not embedded in JSON. They can be refreshed using the exported cache records. A raw SQLite backup is created before portable import.

## Planned interface architecture

The final shell keeps Library, Collections, PSN Trophy Import, Alerts, and Settings as primary destinations. Saved Views become Library state. Search, details, backup/restore, and editing use shared accessible dialogs. Transient mutation feedback uses a central toast system. Reordering uses one accessible drag-and-drop foundation with keyboard alternatives.

The detailed implementation sequence is maintained in [roadmap.md](roadmap.md).
