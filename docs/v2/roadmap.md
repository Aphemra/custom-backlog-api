# Version 2 Release Record and Future Work

## Status

Version 2 is feature complete for its intended personal use.

The original V1 application is preserved separately. V2 is the current `main`-branch product and uses a consolidated current schema rather than the development-era sequence of database rewrites.

This document is no longer an implementation checklist. It records what V2 delivered, what is intentionally outside scope, and how future changes should be introduced without destabilizing the finished application.

## Delivered foundations

### Local-first data model

- Current SQLite schema baseline with future migration support.
- Canonical Library records shared by Collections and Saved Views.
- PS3, PS4, and PS5 domain constraints.
- Play Status model: Unreleased, Not started, Playing, On hold, Waiting, Completed.
- Hidden games separated from Play Status.
- Individual trophy availability overrides and attainable-progress calculations.
- Transactional ordering and mutation validation.

### Library experience

- IGDB-only ordinary game creation.
- Provider search normalization and result-scope controls.
- Persistent local metadata and artwork.
- Compact sortable game rows designed for a vertical monitor.
- Trophy grades, points, completion state, timing, and unobtainable presentation.
- Saved Views integrated into Library tools.
- Temporary filters and sort overrides.
- Drag-and-drop ordering with keyboard alternatives.
- Separate collapsible backlog and completed sections.
- Pinned Collection progress summary.
- Shared dialogs, custom dropdowns, tooltips, toasts, and icon actions.

### Collections

- Ordered Collections and ordered memberships.
- Membership editing from game and Collection workflows.
- Aggregate trophy counts, points, completion, attainable progress, and time estimates.
- Single pinned Collection for current-focus visibility.

### IGDB integration

- Twitch credential configuration through a local `.env` file.
- PS3/PS4/PS5 search with category scopes.
- Add, enrich, and refresh workflows.
- Normalized extended metadata, including screenshots and time estimates.
- Persistent cover, artwork, and screenshot cache.
- Individual and bulk-linked metadata refresh.
- Visible IGDB attribution.

### PlayStation integration

- Dedicated-reader credential model.
- Encrypted NPSSO storage and renewal reminders.
- Connection testing and account validation.
- Title preview, supported-platform filtering, and Library reconciliation.
- Explicit title linking and import.
- Full trophy groups, definitions, earnings, timestamps, and artwork.
- Profile snapshots and calculated trophy points/level progression.
- Linked-games progress sync and full import sync.
- Safe request gate, bounded retries, one-at-a-time lock, cooldown, and visible progress.
- Automatic Completed status at 100%.

### Game intelligence

- Detailed game dialog composed entirely from local records.
- IGDB overview, collapsible story and screenshots, and image lightbox.
- Full trophy list with collapsible groups and secret-trophy protection.
- Trophy timeline and completion durations.
- Per-game IGDB resync.
- Useful trophy page, guide, and interactive-map resources.
- Provider-specific row shortcuts.

### Alerts and history

- New-trophy-set and completion-lost alerts.
- Exact changed-trophy/group details when available.
- Unread badge and alert lifecycle.
- Account trophy log reconstructed from achieved timestamps.
- Calculated trophy-total, platinum-total, and level milestones.
- Level history ranges and custom dates.
- Aggregate trophy-grade/platform statistics and monthly activity.
- Separate append-only backlog action history.

### Settings and recovery

- Sync cooldown and notification timing.
- Configurable accent, status, and unobtainable colors.
- Local PlayStation account and NPSSO management.
- Exact-text Delete Entire Backlog confirmation and pre-delete backup.
- Portable JSON format v5 with preview and transactional replacement.
- Native SQLite safety backups.

### Production and private access

- One compiled Express process serving API and React assets.
- Dedicated production port separate from development.
- Hidden Windows Scheduled Task startup at logon.
- Friendly `.localhost` address.
- Rotating production logs.
- Optional private HTTPS phone access through Tailscale Serve.

## Release acceptance criteria

V2 is considered healthy when:

- type-checking and linting pass
- the API test suite passes
- production build completes
- `/api/health` reports a healthy schema version 1 database
- Windows production starts without a visible terminal
- IGDB search works with configured credentials
- the reader connection test succeeds
- a linked-game progress sync completes without overlap or throttle errors
- cached details, screenshots, and trophies remain readable after providers are unavailable
- portable export and SQLite backup can be created
- a complete cold recovery copy exists outside the runtime drive
- private Tailscale access works only for intended tailnet devices, if enabled

## Intentionally excluded

The following are not unfinished V2 requirements:

- PlatPrices integration
- price tracking
- HowLongToBeat scraping or unofficial API dependency
- trophy rarity analytics
- public deployment
- user accounts or Supabase authentication
- social features
- arbitrary manual game creation
- non-PlayStation platforms
- trophyless games
- PSNProfiles scraping as the synchronization source
- hosting third-party guides or maps
- automatic direct-link discovery through unsupported external scraping

IGDB's stored time estimates satisfy the current time-to-beat use case. PSNProfiles, PowerPyx, and MapGenie are represented as user-managed external resources.

## Deferred ideas

These are optional future improvements, not release blockers:

1. **More tolerant Library search.** Add a tokenized/fuzzy index beyond current case/symbol normalization.
2. **Small visual refinements.** Replace any remaining generic secret-art placeholder and continue consistency checks for rare long-title or narrow-viewport cases.
3. **More mobile adaptation.** Improve compact navigation and dialogs if phone use becomes frequent rather than occasional.
4. **Richer portable recovery.** Add a new portable format version if settings, detailed trophy cache, profile snapshots, or backlog history must become transferable through JSON instead of cold backup.
5. **Automated restore verification.** Add a non-destructive command that restores a backup into a temporary database and runs integrity checks.
6. **Provider compatibility maintenance.** Update IGDB field mapping or `psn-api` parsing only when provider changes make it necessary.
7. **Additional history views.** Add new graphs or comparisons only when they answer a concrete personal question rather than duplicating existing totals.

## Rules for future schema work

The current database baseline remains migration version 1. Do not rewrite it after V2 release for an existing installation.

For a future schema change:

1. Add a new numbered migration.
2. Make it forward-only and transactional.
3. Preserve existing local data.
4. Add fresh-database and upgrade-path tests.
5. Update database-status expectations.
6. Decide explicitly whether portable format v5 can represent the change.
7. If not, create a new portable format version rather than silently dropping data.
8. Create and test a native backup before applying the production migration.

## Rules for future provider work

### PlayStation

- Keep the dedicated-reader model.
- Do not add write operations.
- Keep the serialized one-second request gate unless evidence supports a safer slower value.
- Do not raise retry budgets to mask provider failures.
- Keep the overlap lock and default cooldown.
- Preserve locally stored data when parsing fails.
- Add tests from sanitized provider shapes; never commit credentials or raw private account payloads.

### IGDB

- Keep secrets server-side.
- Continue storing normalized fields needed by the UI.
- Cache all displayed provider images locally.
- Preserve linked metadata during provider outages.
- Make new result categories opt-in rather than allowing them to crowd ordinary game results.

## Rules for future network access

Loopback binding is part of the application security model.

If access expands beyond the current private Tailscale setup, application authentication, authorization, CSRF protections, secure cookie/session handling, origin policy, and a threat review become prerequisites. Do not expose the present API publicly as a convenience shortcut.

## Maintenance cadence

Because this is a personal application, maintenance should remain event-driven:

- renew NPSSO when warned or rejected
- update dependencies deliberately, not automatically
- run the full check suite after dependency or provider changes
- create regular portable exports
- refresh complete cold backups after meaningful backlog/history changes
- review Tailscale access when devices or tailnet members change
- inspect production logs only when diagnosing a symptom

The correct default after V2 is stability, not continuous feature expansion.
