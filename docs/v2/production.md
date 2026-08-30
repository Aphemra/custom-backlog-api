# Production and Recovery

## Purpose

This guide covers the supported Windows production setup, normal updates, optional private phone access, runtime logs, and recovery responsibilities.

Development and production are intentionally separate:

- Development uses Vite on port `5173` and the API on port `3001`.
- Production serves the built web application and API together on port `47831`.

Production does not occupy the development ports.

## Prerequisites

- Windows 10 or Windows 11
- Node.js 24.15 or newer available as `node.exe`
- Repository dependencies installed with `npm install`
- A completed production build
- `apps/api/.env` containing valid IGDB credentials

PlayStation credentials may be entered later through Settings.

## Build and install

From the repository root:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run production:install
```

`production:install`:

1. Verifies that the API and web builds exist.
2. Registers a Scheduled Task named `Trophy Backlog` for the current Windows user.
3. Uses Windows Script Host to keep the launcher invisible.
4. Starts the task immediately.
5. Polls `/api/health` and fails if the application does not become healthy.

The task runs with limited privileges, starts at user logon, ignores duplicate start requests, has no execution-time limit, and retries a failed launch up to three times at one-minute intervals.

## Addresses

On the host PC:

```text
http://127.0.0.1:47831
http://trophy-backlog.localhost:47831
```

The `.localhost` name is a loopback alias. It is only meaningful on the PC running the application and does not create or require a purchased domain.

## Lifecycle commands

```bash
npm run production:start
npm run production:stop
npm run production:uninstall
```

- `production:start` starts the installed task.
- `production:stop` ends the current task instance.
- `production:uninstall` stops and removes the task but preserves application data, images, logs, and credentials.

If the task definition or launcher scripts change, run `npm run production:install` again. It replaces the existing task safely.

## Applying code changes to production

### Final verification

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

The image-route tests can pause for more than a minute while testing background image revalidation.

### Frontend-only changes

After a successful build, the production API serves the new files from `apps/web/dist`. Hard-refresh the browser to discard the previous asset references.

A restart is not normally required, but it is safe:

```bash
npm run production:stop
npm run production:start
```

### API or runtime changes

Build and restart:

```bash
npm run build
npm run production:stop
npm run production:start
```

### Launcher or task changes

Build, then reinstall the task:

```bash
npm run build
npm run production:install
```

## Logs

Production output is written to:

```text
%LOCALAPPDATA%\TrophyBacklog\logs\production.log
```

The launcher rotates the log at 5 MB and retains three older files:

```text
production.log.1
production.log.2
production.log.3
```

If the friendly URL refuses to connect:

1. Run `npm run production:start`.
2. Open `http://127.0.0.1:47831/api/health`.
3. Inspect `production.log`.
4. Confirm that `apps/api/dist/index.js` and `apps/web/dist/index.html` exist.
5. If necessary, run `npm run build` followed by `npm run production:install`.

## Private phone access with Tailscale

Trophy Backlog remains bound to `127.0.0.1`. Tailscale Serve can privately reverse-proxy that loopback service to devices in the same tailnet.

With Tailscale installed and connected on the PC, run in an elevated terminal if required by the local installation:

```bash
tailscale serve --bg http://127.0.0.1:47831
```

Inspect the generated private HTTPS address:

```bash
tailscale serve status
```

Install Tailscale on the phone, sign in to the same tailnet, and open the HTTPS URL reported by Serve.

The `--bg` configuration persists across Tailscale and computer restarts. The Trophy Backlog Scheduled Task still requires the Windows user to sign in, and the PC must remain powered on and awake for phone access.

Use **Tailscale Serve**, not **Tailscale Funnel**. Funnel makes the service public on the internet. Trophy Backlog has no application-level authentication.

Resetting Serve removes the device's complete Serve configuration:

```bash
tailscale serve reset
```

If the device hosts other Serve rules, inspect them before resetting. See the [official Tailscale Serve reference](https://tailscale.com/docs/reference/tailscale-cli/serve).

## Runtime data

Production explicitly uses:

```text
%LOCALAPPDATA%\TrophyBacklog
```

| Item | Purpose |
| --- | --- |
| `trophy-backlog.sqlite` | Authoritative Library, integrations, trophies, history, settings, and alerts. |
| `trophy-backlog.sqlite-wal` | SQLite write-ahead log while the application is running. |
| `trophy-backlog.sqlite-shm` | SQLite shared-memory file while the application is running. |
| `credentials.key` | AES-256-GCM key required to decrypt the NPSSO stored in SQLite. |
| `backups/` | Timestamped SQLite backups created by safety operations or the backup endpoint. |
| `images/` | Locally cached IGDB, PSN title, and trophy artwork. |
| `logs/` | Production launcher logs. |

IGDB credentials remain separately in:

```text
apps\api\.env
```

## Three backup levels

### 1. Portable JSON export

Use the Backup / Restore button in the main navigation.

Format v5 includes:

- Library games and ordering
- Collections and memberships
- Saved Views
- PlayStation game links
- External metadata and metadata links
- Trophy snapshots and alerts
- Cached-image records and Library image links
- Useful game resources

It does not include:

- Cached image binary files
- Appearance and application settings
- Stored PlayStation credentials or `credentials.key`
- IGDB `.env` credentials
- Detailed trophy definitions and earning cache
- PSN profile snapshots
- Backlog action history

Portable export is useful for transfer and partial recovery, but it is not a complete system backup.

Only format v5 is accepted for import. Import validates and previews the file, creates a SQLite backup, and replaces portable data inside a transaction.

### 2. SQLite backup

SQLite backup captures the complete database at one point in time, including data omitted from portable JSON. It still does not contain `credentials.key`, cached image files, or `apps/api/.env`.

Imports and Delete Entire Backlog create a SQLite safety backup automatically. A manual backup can be requested from the local API:

```bash
curl -X POST http://127.0.0.1:47831/api/database/backups
```

The created file is stored under `%LOCALAPPDATA%\TrophyBacklog\backups`.

### 3. Complete cold recovery copy

This is the recommended disaster-recovery backup.

1. Stop production:

```bash
npm run production:stop
```

2. Copy the complete directory below to another drive or protected backup destination:

```text
%LOCALAPPDATA%\TrophyBacklog
```

3. Securely copy the local IGDB environment file:

```text
apps\api\.env
```

4. Restart production:

```bash
npm run production:start
```

Stopping first ensures the SQLite database and its WAL are captured consistently. Do not treat a live copy of only `trophy-backlog.sqlite` as a guaranteed complete snapshot.

Protect the recovery copy because it contains the encrypted NPSSO, the matching decryption key, integration data, and IGDB secret.

## Restore notes

- A SQLite backup must be restored while the application is stopped.
- Keep `credentials.key` paired with the database that contains the encrypted NPSSO.
- If the key is lost, the backlog remains readable, but the saved NPSSO cannot be decrypted and must be re-entered after replacing the key safely.
- Missing cached images can often be downloaded again from stored provider URLs, but a full image-cache copy avoids depending on future provider availability.
- The task and source repository are not contained in `%LOCALAPPDATA%`; preserve the Git repository independently.

## Release lock checklist

Before marking a release:

1. Run type-checking, linting, tests, and the production build.
2. Restart production and verify `/api/health`.
3. Verify IGDB search and a PlayStation connection test.
4. Open a game with cached artwork and detailed trophies.
5. Verify private phone access if Tailscale is used.
6. Create a new portable export and complete cold recovery copy.
7. Reboot Windows once and confirm the app starts after sign-in without a visible console.
8. Create and push an annotated Git tag.
