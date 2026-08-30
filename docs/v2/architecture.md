# Version 2 Architecture

## Overview

Trophy Backlog is a local npm-workspace monorepo with an Express API, React web application, SQLite database, and persistent filesystem image cache.

### Development topology

```text
Browser
  |
  | http://127.0.0.1:5173
  | /api proxied by Vite
  v
React/Vite development server
  |
  | http://127.0.0.1:3001
  v
Express API
  |
  +-- SQLite
  +-- image cache
  +-- IGDB/Twitch
  +-- PlayStation through psn-api
```

### Production topology

```text
Desktop browser                        Phone browser
  |                                      |
  | .localhost / 127.0.0.1               | private Tailscale HTTPS
  v                                      v
                 Express API on 127.0.0.1:47831
                   |
                   +-- serves apps/web/dist
                   +-- mounts /api routes
                   +-- SQLite and runtime files in LocalAppData
                   +-- IGDB/Twitch
                   +-- PlayStation through psn-api
```

Express serves hashed static assets and the Vite `index.html`. Non-API extensionless GET requests fall back to `index.html`. API paths never fall through to the web application.

## Repository boundaries

```text
apps/api/src/
  config/              local-only runtime configuration
  database/            database lifecycle and migration engine
  database/migrations/ current schema baseline and future migrations
  errors/              stable HTTP errors
  features/            domain repositories and integration services
  routes/              HTTP validation and route composition

apps/web/src/
  app/                 application shell and primary navigation
  components/          shared profile, sortable, toast, and UI foundations
  domain/              browser-side API contracts
  features/            page and feature components
  services/api/        HTTP clients
  styles/              global visual system

scripts/               Windows production launch and Scheduled Task setup
docs/v2/               product and engineering documentation
```

Routes validate HTTP input and call feature repositories/services. Provider access, data parsing, persistence, and presentation mapping remain separate so the web UI does not depend directly on undocumented provider payloads.

## Local-only security boundary

`BACKLOG_HOST` accepts only `127.0.0.1` or `localhost`. Supplying another bind address fails startup.

This is a security control: Trophy Backlog has no application login or authorization layer. Private remote access is provided by Tailscale Serve reverse-proxying the loopback service; the API itself does not bind to the LAN or tailnet interface.

The API disables the Express `x-powered-by` header and limits JSON bodies to 25 MB.

## Runtime configuration

The API loads `.env` through `dotenv`. Production explicitly points dotenv at `apps/api/.env` before starting the compiled API.

Defaults:

| Setting | Default |
| --- | --- |
| Host | `127.0.0.1` |
| Development API port | `3001` |
| Production port | `47831` from the Windows launcher |
| Production web directory | `apps/web/dist` |
| Windows data directory | `%LOCALAPPDATA%\TrophyBacklog` |

The default data directory is platform-aware:

- Windows: `%LOCALAPPDATA%\TrophyBacklog`
- macOS: `~/Library/Application Support/TrophyBacklog`
- Linux: `$XDG_DATA_HOME/trophy-backlog` or `~/.local/share/trophy-backlog`

Only the Windows production task is currently packaged and documented.

## Storage model

SQLite is authoritative. The current database starts at schema version 1, named `current_schema_baseline`. It represents the complete V2 schema rather than replaying obsolete development-era schemas. The migration engine and numbered migration directory remain available for additive future changes.

Major tables:

- `library_games`
- `external_game_metadata`
- `game_metadata_links`
- `collections`
- `collection_games`
- `saved_views`
- `trophy_sync_runs`
- `trophy_snapshots`
- `trophy_alerts`
- `app_settings`
- `playstation_game_links`
- `cached_images`
- `library_game_images`
- `playstation_profile_snapshots`
- `playstation_trophy_sets`
- `playstation_trophy_groups`
- `playstation_trophies`
- `playstation_trophy_availability_overrides`
- `igdb_game_details`
- `igdb_metadata_images`
- `game_resources`
- `playstation_credential_settings`
- `backlog_history_entries`

Foreign keys and strict tables enforce ownership and cascading behavior. Complete-order endpoints validate the full record set rather than accepting partial or duplicate orders.

## Library model

A Library game stores title, normalized sort title, PS3/PS4/PS5 platform, Play Status, priority, notes, and hidden timestamp.

Supported Play Status values:

- `unreleased`
- `not_started`
- `playing`
- `on_hold`
- `waiting`
- `completed`

The game-level unobtainable flag is derived and maintained alongside individual trophy availability. Detailed availability calculations distinguish:

- original trophies and points
- attainable trophies and points
- unobtainable trophies and points
- ordinary provider progress
- progress against the attainable maximum

Collections and Saved Views reference canonical Library records; they never duplicate game ownership.

## IGDB integration

The API exchanges Twitch application credentials for IGDB access, normalizes searches, applies PlayStation platform and category scopes, and returns provider results with locally served cover references when available.

Adding a result:

1. Creates the canonical Library game.
2. Stores the external metadata record and link.
3. Stores normalized extended IGDB details.
4. Registers cover, artwork, and screenshot image records.
5. Caches selected image binaries locally.

Existing Library games can be enriched from a selected IGDB result. Linked IGDB metadata can be refreshed per game, and full PlayStation synchronization refreshes all currently linked IGDB metadata.

Provider search normalization removes common symbols and trophy-list suffixes that otherwise reduce matching quality. Search options control platform and whether non-main-game result categories are eligible.

## PlayStation integration

The integration uses a dedicated reader account's NPSSO through `psn-api`.

The main pipeline is:

```text
credentials
  -> authorization token session
  -> reader and target identity resolution
  -> target trophy-title preview
  -> supported-platform selection
  -> Library reconciliation and explicit links
  -> detailed trophy definitions and earnings
  -> local trophy artwork
  -> title snapshots and alerts
  -> profile snapshot and calculated progression
  -> history queries
```

Two sync modes exist:

- **Progress sync:** processes already linked Library games and skips import/reconciliation UI data.
- **Full sync:** previews/reconciles titles, synchronizes linked detailed trophies and snapshots, updates alerts/profile data, and refreshes linked IGDB metadata.

All provider calls share one serialized request gate with a minimum one-second interval. Authorization tokens are cached and refreshed. Sync retries are bounded. A single-process lock rejects overlap, and a database-backed user-configurable cooldown prevents accidental back-to-back sync starts.

Synchronization progress is held in a process-local tracker and exposed to the UI. Restarting the API clears an abandoned in-memory running state.

## Credential storage

IGDB credentials remain in `apps/api/.env` and are never sent to the browser.

PlayStation credentials should be saved through Settings:

- Reader online ID and target online ID are stored locally in SQLite.
- NPSSO is encrypted with AES-256-GCM before storage.
- A random 32-byte key is created as `credentials.key` in the runtime directory.
- The API returns only whether an NPSSO exists and its renewal timestamps, never the stored value.

If no local PlayStation credential field has ever been configured, optional `PSN_*` environment variables act as a fallback. Once local configuration exists, the locally stored set is used as a unit.

The SQLite database and `credentials.key` must remain paired for credential recovery.

## Image cache

Image records store provider, source URL/key, local filename state, validation timestamps, and refresh metadata. Binary files live under `images/` and are served through opaque `/api/images/:imageId` URLs.

Provider hosts are allowlisted by provider type. File paths resolve inside the configured cache directory to prevent traversal.

Serving behavior favors availability:

- A valid local image is served immediately.
- A stale local image is served while revalidation happens in the background.
- A missing local file is refreshed from its recorded provider source where possible.
- Concurrent requests for the same refresh are deduplicated.

IGDB, PSN title, and trophy artwork all use the same persistent cache foundation.

## Trophy intelligence and history

Detailed trophy data stores groups, definitions, earnings, secret state, rarity fields received from PSN, timestamps, and artwork references. Rarity is retained as provider data but is not a product-facing statistic.

Point values are calculated consistently from trophy grade. Trophy timing derives first-trophy, platinum, and 100% milestones only when the required earned timestamps exist.

Account history has two intentionally separate domains:

- **Trophy history** is reconstructed from timestamped earned trophies and includes cumulative counts, points, calculated level, monthly activity, and milestones.
- **Backlog history** is append-only activity produced by local mutations and imports, such as status changes, reordering, hiding, Collection changes, and unobtainable overrides.

Profile snapshots compare PSN totals with locally stored/timestamped trophy coverage so the UI can disclose incomplete historical coverage.

## Alerts

Each synchronization stores title-level trophy snapshots. Comparing successive snapshots can produce:

- `new_trophies` when the provider's defined trophy set expands
- `completion_lost` when a previously 100% title falls below 100%

When detailed definitions are available, set-change analysis records exact added trophies and affected groups. Otherwise the alert remains summary-only.

Alert state is independent of the underlying game and snapshot: unread, read, resolved, or dismissed.

## Web application architecture

The React shell owns primary navigation, the profile trophy summary, the global Backup / Restore dialog, toast notifications, unread-alert count, and animated page transitions.

Primary pages:

- Library
- Collections
- PSN Trophy Import
- Alerts
- History
- Settings

Shared UI primitives provide accessible dialogs, confirmation dialogs, dropdowns, icon buttons, custom portaled tooltips, image lightboxes, sortable lists, and toasts.

The Library loads the canonical game list once and applies Saved Views and temporary refinements in the browser. This avoids refetching the entire Library for ordinary view changes.

## Backup and replacement

Portable format v5 is the only accepted JSON import format. It intentionally covers transferable backlog/integration records rather than every internal table or binary file.

Portable import:

1. Validates the complete document and rejects unknown/inconsistent references.
2. Shows a count comparison without mutation.
3. Requires explicit user acknowledgement.
4. Creates a native SQLite backup.
5. Replaces portable records inside a database transaction.
6. Rolls back on any write failure.

Delete Entire Backlog also creates a SQLite backup first. It removes user backlog content while preserving application settings, built-in views, reusable cached metadata/artwork, and profile history as defined by the maintenance service.

See [Production and recovery](production.md) for the limits of each backup type.

## Failure behavior

- External failures return stable JSON error codes and human-readable messages.
- Existing local data remains readable when IGDB or PSN is down.
- Throttling errors stop rather than escalating retries.
- Overlapping sync attempts return conflict without consuming another cooldown.
- Unsupported or malformed portable data is rejected before replacement.
- Missing cached images are refreshed when possible and fail as images rather than corrupting Library data.
- The production launcher records startup and process failures in rotating local logs.
