# Trophy Backlog

Trophy Backlog is a local-first personal web application for organizing a PlayStation trophy backlog, importing trophy progress through a dedicated reader account, and enriching games with IGDB metadata and locally cached artwork.

Version 2 is feature complete for its intended single-user use. It supports PS3, PS4, and PS5 trophy games and is designed primarily for a vertical desktop monitor, with private phone access available through Tailscale.

## Highlights

- One ordered Library with Play Status, platform, notes, hidden games, and drag-and-drop reordering.
- IGDB-powered game search and import; games are not added manually.
- Stored IGDB metadata including covers, artwork, screenshots, genres, series, storylines, release information, and time-to-beat estimates when available.
- Local persistent caching for IGDB and PlayStation images.
- Ordered Collections with aggregate trophy, attainable-progress, and time-estimate summaries.
- One optional pinned Collection summary on the Library page.
- Built-in and custom Library views with filters for platform, Play Status, Collection, trophy state, synchronization state, alerts, and hidden games.
- Dedicated-reader PlayStation integration with title preview, Library reconciliation, explicit linking/import, detailed trophy caching, profile progression, and guarded synchronization.
- Trophy progress, points, completion timing, trophy groups, secret trophies, and per-trophy unobtainable overrides.
- Alerts for expanded trophy sets and games that lose 100% completion.
- Trophy history, calculated level history, milestones, aggregate statistics, monthly activity, a filterable trophy log, and a separate backlog-action log.
- Useful links for PSNProfiles trophy pages, PowerPyx or other guides, and MapGenie or other interactive maps.
- Portable JSON export/import, transactional replacement, and automatic SQLite safety backups.
- Local settings for PlayStation credentials, synchronization cooldown, NPSSO renewal reminders, notification timing, and appearance colors.
- Hidden Windows production startup with one local production port and optional private HTTPS access through Tailscale Serve.

No PlatPrices dependency is used.

## Technology

- React 19 and Vite 8
- TypeScript 6
- Express 5
- Node.js 24.15 or newer
- Node's built-in SQLite support
- `psn-api` 2.18.1
- IGDB through Twitch application credentials
- `dnd-kit` for accessible drag-and-drop ordering
- Open Sans variable font packaged with the web application

## Repository layout

```text
apps/
  api/                 Express API, SQLite storage, integrations, and tests
  web/                 React user interface
docs/v2/               Product, architecture, API, safety, and operations docs
scripts/               Windows production-task launchers
package.json           Workspace commands
```

## Development setup

1. Install Node.js 24.15 or newer.
2. Run `npm install` from the repository root.
3. Copy `apps/api/.env.example` to `apps/api/.env`.
4. Add `IGDB_CLIENT_ID` and `IGDB_CLIENT_SECRET` to `apps/api/.env`.
5. Run `npm run dev`.
6. Open `http://127.0.0.1:5173`.

Development uses two local-only processes:

- Web: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:3001`

The Vite development server proxies `/api` requests to the API.

PlayStation reader and target account details should normally be entered through the Settings page. Environment-variable fallback is supported, but is not required.

## IGDB setup

1. Sign in to the [Twitch Developer Console](https://dev.twitch.tv/console/apps).
2. Register an application.
3. Copy its client ID and client secret into `apps/api/.env`:

```dotenv
IGDB_CLIENT_ID=your_client_id
IGDB_CLIENT_SECRET=your_client_secret
```

Keep the real `.env` file local. It is ignored by Git and must never be committed.

## PlayStation setup

Use a dedicated reader account rather than the target trophy account.

1. Open Settings in Trophy Backlog.
2. Enter the reader account online ID.
3. Enter the target trophy account online ID.
4. Sign in to PlayStation with the reader account.
5. Use the NPSSO shortcut in Settings and paste the 64-character value.
6. Save, then run the connection test from PSN Trophy Import.

The reader and target IDs must be different. The target account's trophy privacy must permit the reader account to see its trophy data.

The NPSSO is encrypted before it is stored in SQLite. The API never returns the saved value to the browser.

See [PlayStation API safety](docs/v2/api-safety.md) before using synchronization.

## Production on Windows

Production serves both the compiled React application and API from one local process on port `47831`.

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run production:install
```

Open either:

- `http://127.0.0.1:47831`
- `http://trophy-backlog.localhost:47831`

The installed Scheduled Task starts invisibly when the current Windows user signs in. VS Code and a terminal do not need to remain open.

See [Production and recovery](docs/v2/production.md) for updates, logs, Tailscale access, backups, and disaster recovery.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development API and Vite server together. |
| `npm run dev:api` | Start only the API in watch mode. |
| `npm run dev:web` | Start only the Vite web application. |
| `npm run typecheck` | Type-check both workspaces. |
| `npm run lint` | Lint the web workspace. |
| `npm test` | Build and run the API test suite. |
| `npm run build` | Build the API and production web application. |
| `npm run start` | Run the compiled API in the foreground. |
| `npm run production:install` | Install or replace the hidden Windows startup task and start it. |
| `npm run production:start` | Start the installed production task. |
| `npm run production:stop` | Stop the installed production task. |
| `npm run production:uninstall` | Remove the production task without deleting application data. |

The image-route tests exercise delayed background revalidation and can take over a minute. Do not assume the suite is stuck solely because output pauses there.

## Runtime configuration

| Variable | Purpose |
| --- | --- |
| `BACKLOG_HOST` | API host. Only `127.0.0.1` and `localhost` are accepted. |
| `BACKLOG_PORT` | API port. Defaults to `3001`; the Windows launcher sets `47831`. |
| `BACKLOG_DATA_DIRECTORY` | Absolute or API-relative runtime-data directory. |
| `BACKLOG_WEB_DIRECTORY` | Compiled web directory served by the API. |
| `IGDB_CLIENT_ID` | Twitch application client ID used for IGDB. |
| `IGDB_CLIENT_SECRET` | Twitch application client secret used for IGDB. |
| `PSN_READER_NPSSO` | Optional environment fallback for the reader NPSSO. |
| `PSN_READER_ONLINE_ID` | Optional environment fallback for the reader online ID. |
| `PSN_TARGET_ONLINE_ID` | Optional environment fallback for the target online ID. |

Values saved through Settings take precedence over PlayStation environment fallbacks once any local PlayStation credential field has been configured.

## Runtime data

On Windows, the default and production data directory is:

```text
%LOCALAPPDATA%\TrophyBacklog
```

It contains:

- `trophy-backlog.sqlite` — authoritative application database.
- `credentials.key` — local 32-byte key required to decrypt the stored NPSSO.
- `backups/` — timestamped SQLite safety backups.
- `images/` — persistent IGDB and PlayStation image cache.
- `logs/` — production-launcher logs.

The database, `credentials.key`, image directory, and `apps/api/.env` serve different recovery purposes. Backing up only one of them is not a complete disaster-recovery copy.

## Documentation

- [Product scope](docs/v2/scope.md)
- [Architecture](docs/v2/architecture.md)
- [Local API reference](docs/v2/api.md)
- [PlayStation API safety](docs/v2/api-safety.md)
- [Production and recovery](docs/v2/production.md)
- [Release record and future work](docs/v2/roadmap.md)

## Product boundaries

Trophy Backlog is intentionally a personal, single-user, local-first tool. It is not a public trophy service, social network, price tracker, trophy-guide host, or PSNProfiles replacement. It does not include application-level authentication, so it must remain bound to loopback and may only be shared privately through a trusted network layer such as Tailscale Serve.
