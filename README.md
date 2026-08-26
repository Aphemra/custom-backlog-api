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
- A functional React library interface with search, summary counts, manual game
  entry, editing, archiving, restoration, deletion confirmation, and ordering
- Collection creation, editing, deletion, ordering, ordered game membership,
  aggregate counts, and a focused game-selection interface
- Saved-view API support with built-in views, custom view creation, editing,
  deletion, ordering, and server-side game filtering
- Versioned portable JSON export, validation, preview, automatic pre-import
  SQLite backup, and atomic library/Collection/saved-view replacement through
  the API; older version-one files remain importable
- A functional Import / Export interface with native JSON downloads, local file
  selection, count comparison, and explicit replacement acknowledgement
- Responsive layouts for portrait desktop monitors and narrow screens

The saved-view interface, metadata search, trophy synchronization, and alerts
are still to be built. Trophy-dependent built-in views are present but remain
explicitly unavailable until synchronization supplies real trophy data.

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
- Collections API: `http://127.0.0.1:3001/api/collections`
- Saved views API: `http://127.0.0.1:3001/api/saved-views`
- Portable data API: `http://127.0.0.1:3001/api/data`

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
