# Trophy Backlog

Trophy Backlog is a local-first personal application for organizing
PlayStation games and tracking trophy progress.

The application is designed primarily for a vertical desktop monitor. It
tracks trophy-bearing PS3, PS4, and PS5 titles, including trophy-enabled
PlayStation Classics.

## V2 status

The `main` branch contains the v2 application. The previous implementation is
preserved on the `v1` branch.

V2 currently includes:

- A local-only Express API
- SQLite persistence and numbered migrations
- Local SQLite backup creation
- Persistent library game creation, editing, ordering, archiving, restoration,
  and permanent deletion
- Strict request validation and automated API/database tests
- A minimal React application shell

The library user interface, collections, saved views, metadata search, trophy
synchronization, alerts, and portable import/export are still to be built.

## Requirements

- Node.js 24.15 or newer
- npm 11 or newer

Node 24 provides the built-in SQLite runtime used by the local API, so no
separate database server or third-party native database package is required.

## Commands

Install the workspace:

```bash
npm install
```

Run the API and web application:

```bash
npm run dev
```

Verify the project:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Local addresses

- Web application: `http://127.0.0.1:5173`
- API health check: `http://127.0.0.1:3001/api/health`
- Database status: `http://127.0.0.1:3001/api/database/status`
- Library API: `http://127.0.0.1:3001/api/library/games`

Both development servers are intentionally restricted to the local computer.

## Local data

The SQLite database is stored at:

```text
apps/api/runtime/trophy-backlog.sqlite
```

SQLite backups are stored under:

```text
apps/api/runtime/backups/
```

The entire `apps/api/runtime/` directory is ignored by Git.

## Product documentation

- `docs/v2/scope.md`
- `docs/v2/architecture.md`
- `docs/v2/api.md`
- `docs/v2/api-safety.md`
