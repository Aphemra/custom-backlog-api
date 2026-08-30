# Version 2 Product Scope

## Product statement

Trophy Backlog is a personal, local-first web application for deciding what PlayStation trophy game to pursue next, tracking progress toward completion, and preserving a useful history of the account and backlog.

It serves one user and one target PSN account. It favors at-a-glance information, explicit user control, local persistence, and safe provider access over public sharing or multi-user complexity.

## Design principles

1. **Local ownership.** The database, backups, cached media, settings, and credential-encryption key live on the user's computer.
2. **Trophy relevance.** PS3, PS4, and PS5 games with trophies are the supported domain.
3. **One canonical Library.** Collections and Saved Views organize the same game records rather than creating duplicate backlogs.
4. **IGDB-backed identity.** Games added outside PSN import originate from IGDB and retain provider metadata.
5. **Explicit PlayStation mutations.** Connection tests, previews, links, imports, and synchronization require deliberate user actions.
6. **Provider safety.** PlayStation requests are serialized, spaced, bounded, locked against overlap, and protected by a configurable sync cooldown.
7. **Durable presentation.** Previously stored games, trophies, metadata, and cached images remain useful during provider outages.
8. **Recoverability.** Portable export, automatic SQLite safety backups, and full runtime-folder backups serve distinct recovery needs.
9. **Useful density.** The vertical-monitor interface exposes meaningful trophy state without turning each row into a dashboard.
10. **Personal-tool restraint.** Features that require public hosting, accounts, social systems, or service-scale infrastructure are excluded.

## Supported content

- PS3 trophy games
- PS4 trophy games
- PS5 trophy games
- PlayStation Classics when a trophy list exists and the title is represented by a supported PSN trophy platform
- Base games, compilations, editions, and bundles when their IGDB and PSN records represent a relevant trophy list
- DLC/additional trophy groups as part of a game's stored trophy set

Trophyless software and non-PlayStation platforms are outside the product's purpose.

## Complete feature set

### Library

- Search IGDB and add a PS3, PS4, or PS5 game.
- Normalize provider search terms, including registered/trademark symbols and common trophy-list suffixes.
- Refine IGDB results by platform and result scope.
- Order the active backlog with pointer or keyboard drag-and-drop.
- Keep completed games in a separate collapsible section.
- Hide and restore games without deleting their stored data.
- Permanently delete individual games with confirmation.
- Assign one of: Unreleased, Not started, Playing, On hold, Waiting, or Completed.
- Automatically default newly added undated/future IGDB games to Unreleased.
- Automatically set a linked game to Completed after a PSN sync reaches 100%.
- Store optional personal notes.
- Display platform, Play Status, trophy progress, trophy grades, points, completion state, attainable progress, and useful-resource shortcuts.
- Mark individual trophies unobtainable with an optional reason.
- Calculate progress against attainable trophies and points while retaining original totals.
- Color unobtainable games distinctly from ordinary Play Status colors.
- Open a details dialog with locally composed IGDB, PSN, image, history, and resource data.
- Refresh one game's linked IGDB metadata.

### Game details

- IGDB cover, summary, release information, developer, publisher, modes, type, rating, genres, series, storyline, and time estimates when stored.
- Collapsible spoiler-sensitive storyline.
- Collapsible screenshot gallery and full-screen lightbox with navigation.
- Trophy counts, points, progress, attainable progress, and unobtainable totals.
- Trophy timing for first trophy, platinum, and 100% completion when timestamps permit it.
- Collapsible progress history.
- Complete trophy list grouped by PSN trophy group.
- Secret-trophy obfuscation until deliberately revealed.
- Provider-aware useful links for trophy pages, guides, and interactive maps.

### Collections

- Create, rename, describe, order, and delete Collections.
- Add a game from either its edit dialog or the Collections page.
- Order games inside each Collection.
- Aggregate games, visibility, completion, trophy counts, points, attainable progress, unobtainable trophies, and IGDB time estimates.
- Pin at most one Collection and show its progress summary beneath Library tools.

Collections are user-curated series or goal groups. They do not own duplicate game records.

### Saved Views and filtering

- Built-in views for common Library states.
- Custom views created from the same filter and sort controls used for temporary refinements.
- Filters for search, platform, Play Status, hidden state, Collection, platinum, 100%, sync state, alert type, and alert status.
- Sort by manual priority, title, platform, Play Status, creation/update date, progress, last sync, or alert date.
- Reorder Saved Views.
- Apply temporary refinements without rewriting the selected view.
- Move completed games to the bottom of the canonical manual order.

### PlayStation integration

- Store reader account, target account, and NPSSO locally through Settings.
- Test the dedicated reader connection.
- Preview supported PSN trophy titles and exclude unsupported platforms.
- Reconcile titles as linked, suggested, ambiguous, or new.
- Filter the import screen, including a Missing IGDB workflow.
- Link a PSN title to an existing Library game.
- Create a Library game from a PSN title, then attach IGDB metadata.
- Cache PSN title icons, trophy artwork, trophy groups, definitions, earnings, timestamps, and profile snapshots.
- Run a full synchronization from PSN Trophy Import.
- Run a linked-games progress synchronization from the Library.
- Show granular synchronization phases and progress.
- Refresh linked IGDB metadata during a full synchronization.
- Preserve a calculated profile trophy level and points progression.

### Alerts

- Create an alert when a stored trophy set gains trophies.
- Identify affected groups and exact added trophies when detail data permits.
- Create an alert when a game that was 100% complete falls below 100%.
- Track unread, read, resolved, and dismissed states.
- Display unread count in primary navigation.

### History

- Reconstruct timestamped trophy history from locally stored earned trophies.
- Calculate trophy points and level progression consistently across the account's stored history.
- Track trophy-total, platinum-total, and trophy-level milestones.
- Display level history with preset and custom date ranges.
- Display aggregate totals by trophy grade and platform.
- Display monthly trophy and point activity.
- Provide a paginated, filterable trophy log.
- Keep backlog actions separate from trophy acquisition history.
- Record game, Play Status, platform, visibility, order, trophy availability, Collection, import, and deletion actions.

Rarity statistics are intentionally excluded.

### Settings and appearance

- Configure PSN reader ID, target ID, NPSSO, and renewal-warning lead time.
- Track the NPSSO entry date and estimated renewal date.
- Configure or disable the Library sync cooldown.
- Configure toast-notification duration.
- Customize the accent and each Play Status color within the dark interface.
- Delete the entire backlog only after typing the exact confirmation text.
- Create a recovery SQLite backup before destructive backlog deletion.

### Backup and production

- Download and preview/import portable JSON format v5.
- Create a SQLite safety backup before portable replacement.
- Serve the production web application and API from one local process.
- Start production invisibly at Windows logon.
- Use a friendly `.localhost` address on the PC.
- Optionally use Tailscale Serve for private phone access.

## Source-of-truth boundaries

- **SQLite** is authoritative for user organization, links, cached provider records, trophies, history, alerts, and settings.
- **IGDB** is the source for games added outside PSN import and the preferred metadata source.
- **PSN** is the source for account identity, trophy titles, trophy definitions, earnings, timestamps, and profile totals.
- **Local image files** are the preferred serving source after an image has been cached.
- **User-entered overrides** are authoritative for Play Status, notes, Collection membership/order, useful links, and trophy unobtainability.

## Non-goals

- Public deployment or anonymous internet access
- Multiple users, application accounts, or role-based access
- Social feeds, messaging, comparisons, or leaderboards
- PlatPrices or price tracking
- Trophy rarity analysis
- Hosting or republishing third-party guides
- Replacing PSNProfiles
- Scraping PSNProfiles as the primary synchronization source
- Storing arbitrary manually created games that do not exist in IGDB or PSN import
- Supporting Xbox, Nintendo, Steam, or trophyless PlayStation software
- Supabase or another hosted database for the current personal deployment
- Cross-device editing while the host PC is offline

## Availability expectations

IGDB and PlayStation are external dependencies only for new provider data. The Library, Collections, Saved Views, cached game details, cached trophy data, history, alerts, settings, exports, and existing images must remain useful while either provider is unavailable.

Phone access depends on the host PC being powered on, signed in, running Trophy Backlog, and connected to Tailscale.
