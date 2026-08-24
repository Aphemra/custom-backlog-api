# Trophy Backlog

Trophy Backlog is a local-first personal application for organizing
PlayStation games and tracking trophy progress.

The application is designed primarily for a vertical desktop monitor. It
tracks trophy-bearing PS3, PS4, and PS5 titles, including trophy-enabled
PlayStation Classics.

## V2 status

The `main` branch contains the v2 application. The previous implementation
is preserved on the `v1` branch.

V2 is currently a clean application shell. Storage, trophy synchronization,
metadata search, collections, saved views, alerts, and backup features will
be added incrementally.

## Requirements

- Node.js 24.15 or newer
- npm 11 or newer

Node 24 provides the built-in SQLite runtime used by the local API, so no
separate database server or native database package is required.

## Commands

Install the workspace:

```bash
npm install
```

Run the API and web application:

```bash
npm run dev
```
