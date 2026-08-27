# Trophy Backlog

Trophy Backlog is a local-first personal web app for organizing a PlayStation trophy backlog, importing trophy progress from a dedicated reader account, and enriching games with IGDB metadata and locally cached artwork.

The app is designed primarily for a vertical desktop monitor. It runs on one computer, stores its data in a local SQLite database, and exposes its API only on `127.0.0.1` or `localhost`.

## Current status

Version 2 is under active development. The current build includes:

- Library game creation, editing, ordering, hiding through the current archive mechanism, restoration, and permanent deletion.
- PS3, PS4, and PS5 games only.
- Ordered Collections with ordered game membership.
- Saved Views with filters for platform, status, Collections, trophy state, sync state, alerts, and hidden/active state.
- IGDB search, optional DLC and edition results, Library import, metadata enrichment, and locally cached cover artwork.
- PlayStation reader-account connection testing, trophy-title preview, reconciliation, Library linking/import, trophy-summary snapshots, and change alerts.
- Cached PlayStation title icons.
- Trophy alerts for newly added trophies and loss of 100% completion.
- Portable JSON export/import format v3, including Library, Collections, Saved Views, integration links, metadata, trophy snapshots, alerts, and cached-image records.
- Automatic SQLite backup before portable-data import and a manual backup endpoint.

Several screens and terms are still transitional. In particular, the current `Pursuit Status`, `Archive`, separate Saved Views page, separate Import/Export page, and text-heavy game cards are scheduled for replacement. See [the roadmap](docs/v2/roadmap.md).

## Technology

- React 19 and Vite 8
- TypeScript 6
- Express 5
- Node.js 24 or newer
- Node's built-in SQLite support
- `psn-api` 2.18.1
- IGDB API through Twitch application credentials

No PlatPrices dependency is used or planned.

## Local setup

1. Install Node.js 24.15 or newer.
2. Run `npm install` from the repository root.
3. Copy `apps/api/.env.example` to `apps/api/.env`.
4. Add IGDB and PlayStation credentials to `apps/api/.env` as needed.
5. Run `npm run dev`.
6. Open `http://127.0.0.1:5173`.

The API listens on `http://127.0.0.1:3001` by default.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `BACKLOG_HOST` | API host. Only `127.0.0.1` and `localhost` are accepted. |
| `BACKLOG_PORT` | API port. Defaults to `3001`. |
| `BACKLOG_DATA_DIRECTORY` | SQLite, backup, and image-cache directory. Defaults to `apps/api/runtime`. |
| `IGDB_CLIENT_ID` | Twitch application client ID used for IGDB. |
| `IGDB_CLIENT_SECRET` | Twitch application client secret used for IGDB. |
| `PSN_READER_NPSSO` | NPSSO token for the dedicated reader account. |
| `PSN_READER_ONLINE_ID` | Reader account online ID. Must differ from the target account. |
| `PSN_TARGET_ONLINE_ID` | Trophy account to read. |

Credentials stay server-side and must never be committed. The PlayStation reader account must not be used for normal play or write actions.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the API and web app together. |
| `npm run dev:api` | Start only the API in watch mode. |
| `npm run dev:web` | Start only the web app. |
| `npm run typecheck` | Type-check both workspaces. |
| `npm run test` | Run available workspace tests. |
| `npm run lint` | Lint the web workspace. |
| `npm run build` | Build both workspaces. |
| `npm run start:api` | Run the built API. |

## Runtime data

By default, runtime files live under `apps/api/runtime`:

- `trophy-backlog.sqlite` — the primary database.
- `backups/` — SQLite backups created by the app.
- `images/` — locally cached IGDB and PlayStation images.

Portable JSON exports are the user-controlled recovery format. Cached image records are portable, but the image files themselves should be treated as a rebuildable cache rather than the only copy of important information.

## Documentation

- [Product scope](docs/v2/scope.md)
- [Architecture](docs/v2/architecture.md)
- [API reference](docs/v2/api.md)
- [PlayStation API safety](docs/v2/api-safety.md)
- [Implementation roadmap](docs/v2/roadmap.md)

## Product boundaries

Trophy Backlog is intentionally a single-user, local-only tool. It will not become a public social network, hosted trophy service, price tracker, trophy-guide host, or replacement for PSNProfiles. External guide, map, and PSNProfiles links may be stored for quick access, but the app will not scrape or republish those services.
