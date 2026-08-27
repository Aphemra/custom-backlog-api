# Version 2 Product Scope

## Purpose

Trophy Backlog is a private, local-first PlayStation trophy planning and progress app. Its job is to make one person's backlog understandable at a glance while keeping PSN access conservative and external-service dependencies replaceable.

The primary layout target is a vertical desktop monitor. Mobile-friendly behavior is desirable, but cross-device synchronization is not a requirement.

## Product principles

1. **Local ownership.** SQLite, backups, cached art, and portable exports live on the user's computer.
2. **Read-only integrations.** The app reads PSN trophy data through a dedicated reader account and never performs account-changing actions.
3. **Low-friction progress.** Updating trophy progress for games already in the Library should be a direct Library action.
4. **One metadata source where practical.** IGDB is the source for games added outside PSN import and the main source of descriptive metadata and art.
5. **Useful at a glance, never needlessly dense.** Platform, play state, trophy state, progress, and useful links should be easy to scan.
6. **Simple concepts.** Collections are ordered, user-curated series or groups. Saved Views are reusable Library filters, not a second kind of collection.
7. **Recoverable changes.** Portable export/import and local database backups protect the user's data.

## Required product capabilities

### Library

- Store only PS3, PS4, and PS5 games that have trophy lists.
- Add games through IGDB search or PSN trophy import.
- Order the complete Library manually.
- Filter and sort through Saved Views.
- Hide games without deleting them.
- Show compact trophy, platform, play-state, and completion information.
- Open rich game details without leaving the Library.

### Play state

The target term is **Play Status**, with these normal values:

- `Unreleased`
- `Not Started`
- `Playing`
- `On Hold`
- `Waiting`
- `Completed`

`Unobtainable` is a separate completion constraint, not a play status. Hiding is also separate from play status.

The current implementation still stores the older **Pursuit Status** values (`unplanned`, `pursuing_soon`, `in_progress`, `paused`, `finished`, and `abandoned`). Checkpoint 2 migrates the data and interface.

New IGDB games with a future release date should begin as `Unreleased`. A PSN-linked game reaching 100% should automatically become `Completed`; a platinum below 100% must not force that state.

### Collections

- Create freeform, ordered game groups such as a franchise or personally curated set.
- Order Collections and their member games through drag and drop.
- Add a game to Collections from either the Collection screen or game editor.
- Show game, trophy, point, completion, and estimated-time aggregates when their source data exists.

### Saved Views

- Define reusable filters and sorting for the Library.
- Select, create, edit, and delete views from the Library rather than a dedicated navigation page.
- Preserve built-in views while allowing custom views.
- Treat manual drag ordering as available only when the current result represents the complete manual Library order.

### IGDB

- Search games with optional DLC and edition/bundle inclusion.
- Keep DLC below base-game results and support platform refinements.
- Normalize punctuation, symbols, full-width characters, and trophy-list suffixes that interfere with searches.
- Use IGDB for covers, screenshots, release information, descriptions, companies, genres, modes, franchises/collections, editions, and time-to-beat data when available.
- Cache referenced images locally and allow deliberate refresh.
- Display a visible, restrained `Powered by IGDB` attribution.

### PlayStation trophies

- Authenticate through a dedicated reader account and read a public target account.
- Preview and reconcile PSN trophy titles before importing or linking them.
- Synchronize only already-linked Library games from the main Library action.
- Store title-level snapshots, profile trophy progression, full trophy groups and trophies, earned timestamps, rarity, and locally cached icons.
- Detect newly added trophies and a previously 100% game falling below 100%.
- Calculate trophy points, level progress, and reliable first-trophy/platinum/100% elapsed times.
- Omit unavailable duration from compact game rows; explain missing timestamps only in game details.

### Resources

- Store zero or more links per game.
- Support an exact PSNProfiles page, PSNProfiles search fallback, PowerPyx and PSNProfiles guides, other guide sources, MapGenie maps, and other map sources.
- Show compact source-aware icons on the game row only when links exist.
- Keep discovery and link entry manual; do not scrape third-party sites.

### Safety, settings, and recovery

- Enforce PSN request spacing, retry limits, a configurable sync cooldown, and an in-flight sync lock in the API.
- Allow the cooldown to be disabled deliberately; default to 300 seconds.
- Configure toast expiration.
- Export and preview/import a portable JSON backup from a Library modal.
- Create a SQLite backup before destructive replacement.
- Offer `Delete Entire Backlog` only after the exact phrase is typed.

## Current implementation baseline

The repository already has Library and Collection CRUD/order, Saved Views, portable format v3, IGDB search/import/enrichment, local image caching, PSN connection/preview/reconciliation/link/import, title-level trophy snapshots, alerts, and working UI screens for those features.

The remaining work is primarily deeper trophy data, safer fast sync, richer metadata/resources, terminology migration, interface consolidation, drag and drop, final visual design, and hardening. The ordered plan is in [roadmap.md](roadmap.md).

## Non-goals

- Public hosting, multi-user accounts, authentication, Supabase, or cloud synchronization.
- PSN write actions, automated play activity, or use of the primary account as the integration credential.
- PlatPrices, price tracking, shopping lists, or deal alerts.
- Games without trophies or platforms other than PS3, PS4, and PS5.
- Hosting, copying, or scraping trophy guides, PSNProfiles, MapGenie, or HowLongToBeat.
- Automatic third-party guide/map discovery.
- Social feeds, leaderboards, messaging, or public profiles.
- A full trophy-guide authoring system.
- Manual creation of non-PSN game records once IGDB-only Library search is complete.
