# Version 2 Implementation Roadmap

This roadmap takes the current working baseline to the intended polished personal app. Checkpoints are ordered to settle data contracts and safety before visual consolidation. A checkpoint should be committed only after its migrations, tests, type-checking, and relevant manual checks pass.

## 1. Re-baseline documentation

**Purpose:** Make the repository describe the application that actually exists and the product now intended.

- Replace the README and all version 2 product/API/safety documents.
- Record implemented features, transitional terminology, non-goals, and the ordered roadmap.
- Correct portable data from v2 to v3 and document existing PSN/IGDB/image behavior.

**Done when:** Documentation contains no known claims that contradict the current routes, storage format, or agreed product direction.

## 2. Replace Pursuit Status with Play Status

**Purpose:** Fix the core vocabulary and data model before more features depend on it.

- Migrate old values to `Unreleased`, `Not Started`, `Playing`, `On Hold`, `Waiting`, and `Completed`.
- Store `Unobtainable` separately from play status.
- Rename Archive language to Hide, Hidden Games, and Unhide while retaining safe storage behavior.
- Auto-select `Unreleased` for newly added future releases.
- Auto-select `Completed` when a linked game reaches 100%; do not auto-complete a platinum below 100%.

**Done when:** API, database, exports, filters, tests, and UI use the new model without ambiguous legacy labels.

## 3. Typed Settings and synchronization policy

**Purpose:** Establish safety controls before adding the convenient Library sync.

- Implement typed persisted settings.
- Add a trophy-sync cooldown toggle and seconds value, defaulting to enabled at 300 seconds.
- Add API-enforced cooldown checks and a single in-flight sync lock.
- Add notification expiration settings for the future toast system.
- Keep conservative provider request spacing and bounded retries.

**Done when:** Double-clicks and multiple tabs cannot overlap syncs, and cooldown behavior is enforced server-side and covered by tests.

## 4. Library `Sync Trophy Progress`

**Purpose:** Make the common progress refresh fast and direct.

- Add a Library action that updates only already-linked games and profile progression.
- Exclude PSN import decisions, title matching, IGDB lookup, and Library creation.
- Apply the 100%-to-Completed rule.
- Make PSN Import default to `New`, fall back to `Missing IGDB`, then `All` when preceding queues are empty.

**Done when:** One Library action safely refreshes front-facing progress and returns a clear summary without opening the import workflow.

## 5. Complete PSN trophy ingestion

**Purpose:** Store the raw detail required for exact alerts, timings, and game details.

- Add normalized trophy groups and individual trophies.
- Store provider IDs, descriptions, types, icons, secret state, earned state/timestamp, rarity, and PS5 progress where available.
- Cache trophy and group artwork locally.
- Fetch detailed trophies deliberately and incrementally rather than multiplying requests unnecessarily.

**Done when:** A linked title can be reconstructed from local normalized records without another provider request.

## 6. Trophy intelligence and profile progression

**Purpose:** Turn stored trophy data into useful personal analytics.

- Calculate trophy points and points remaining at game, Collection, and profile levels.
- Prefer PSN's level/progress as server truth while validating calculations.
- Calculate first-trophy, platinum, and 100% timestamps and elapsed durations.
- Show duration on a compact game row only when reliable; explain missing timestamps only in details.
- Produce exact new-trophy/group alerts and preserve historical snapshots.
- Support marking known trophies or a game as unobtainable.

**Done when:** Totals, points, timings, and alerts are deterministic from stored data and tested against edge cases.

## 7. Rich IGDB metadata and artwork

**Purpose:** Make IGDB the useful descriptive source of truth.

- Import descriptions, cover/artwork/screenshots, platforms/releases, companies, genres, modes, franchises/collections, editions, and IGDB time-to-beat values when available.
- Add platform and category refinements while preserving DLC/edition toggles and result ordering.
- Formalize image refresh/staleness behavior.
- Keep imported metadata usable offline.

**Done when:** Game details can be built from stored IGDB data and cached images without live page dependencies.

## 8. Game Resources

**Purpose:** Make frequently used guides and maps one click away without scraping third parties.

- Add ordered, labeled, multiple links per game.
- Support exact PSNProfiles page plus a generated PSNProfiles search fallback.
- Support PowerPyx, PSNProfiles, and other guides.
- Support MapGenie and other interactive maps.
- Derive source-aware icons from explicit resource type/provider, not fragile URL-only guesses.

**Done when:** Resources can be edited safely and compact icons appear only when applicable.

## 9. Shared visual foundation

**Purpose:** Build reusable interaction primitives before redesigning every screen.

- Bundle and use Open Sans.
- Define spacing, color, type, status-tint, and responsive tokens for the vertical-monitor target.
- Add accessible icon buttons, tooltips, dialogs, confirmations, and toast notifications.
- Add one accessible drag-and-drop system with keyboard alternatives.

**Done when:** Subsequent screens can use consistent primitives instead of one-off controls.

## 10. Application shell and Settings

**Purpose:** Reduce header/navigation weight and expose real configuration.

- Shrink the title and emphasize profile trophy totals/progression.
- Remove the `Local Database` badge and show restrained `Powered by IGDB` attribution.
- Add clear navigation hover/focus states.
- Rename PlayStation to `PSN Trophy Import`.
- Remove Saved Views and Import/Export from primary navigation.
- Build the Settings screen for sync safety, notification timing, and destructive maintenance.

**Done when:** The shell is compact, keyboard-visible, descriptive, and focused on trophy information.

## 11. Integrate Saved Views and filtering into Library

**Purpose:** Make Saved Views behave as intended: reusable definitions of the backlog.

- Add Library view selection and filter/sort controls.
- Create/edit views in dialogs.
- Include Hidden Games as a Library view/filter.
- Allow manual drag ordering only for the complete manual-order result.
- Establish the main toolbar: Search, Sync Trophy Progress, and Backup/Restore.

**Done when:** The separate Saved Views screen is unnecessary and every view filters the same Library presentation.

## 12. Unified Search and Game Details dialogs

**Purpose:** Stop searches and details from pushing the Library around or producing inconsistent experiences.

- Put IGDB search in a modal and rename it simply `Search`.
- Remove Add Manually from the UI; non-PSN additions originate in IGDB.
- Use the same rich details component for Library rows, IGDB results, and PSN metadata matching.
- Include screenshots, metadata, time, trophy, and resource sections when data exists.

**Done when:** Clicking any game-like result opens a consistent details experience and search no longer displaces the Library.

## 13. Final game row and editor

**Purpose:** Deliver the main at-a-glance experience.

- Redesign rows with stable positions for platform, Play Status, completion state, trophy counts, points, progress, and artwork.
- Use restrained status coloring that remains accessible and does not overpower the art.
- Label platinum below full completion as `Platinum earned but not 100%`.
- Show reliable elapsed completion time only when available.
- Add compact resource icons and icon-only edit/hide/delete actions with tooltips.
- Add Collection selection to the editor; append newly selected games to each Collection.
- Keep Notes collapsed when empty, with add/edit/delete controls.

**Done when:** Important state is readable at a glance on a vertical monitor without visual density or layout drift.

## 14. Collections redesign and aggregates

**Purpose:** Restore Collections to simple ordered personal groups while making their summaries valuable.

- Add drag ordering for Collections and member games.
- Show games completed/total, trophies earned/total, points earned/remaining, and time estimates with source coverage.
- Reuse final game rows/details where appropriate.

**Done when:** Collections are easy to curate and summarize without becoming another filtering system.

## 15. PSN Import and Alerts polish

**Purpose:** Make exception workflows focused and informative.

- Use the `New` → `Missing IGDB` → `All` default rule.
- Keep linked titles secondary and easy to filter.
- Reuse unified matching search and game details.
- Show exact new trophy/group changes and completion-loss context.
- Add unread indicators and route transient success/failure feedback through toasts.

**Done when:** Import is a queue of work that needs attention, not a wall of already-resolved games.

## 16. Backup, restore, and Delete Entire Backlog

**Purpose:** Finish local ownership and recovery before release.

- Move portable export/import into a Library modal.
- Extend the portable contract for all new settings, resources, metadata, trophies, profile snapshots, and ordering.
- Preview replacements and create a SQLite backup before destructive changes.
- Add `Delete Entire Backlog` in Settings, enabled only after typing the exact phrase.
- Define deletion scope explicitly: backlog/integration/cache data is removed, credentials remain environment-owned, and required built-ins are restored.

**Done when:** A user can recover, migrate, or deliberately reset all personal backlog data without ambiguity.

## 17. Final hardening, accessibility, and release

**Purpose:** Turn the feature-complete build into a dependable daily tool.

- Test fresh install, migration, backup/restore, integration outages, expired credentials, interrupted sync, and missing image files.
- Audit keyboard use, focus management, reduced motion, color contrast, tooltips, dialogs, and drag alternatives.
- Tune vertical-monitor and narrow layouts.
- Remove transitional routes/UI only after compatibility needs are settled.
- Run type-check, tests, lint, and production build; update screenshots and all documentation.

**Done when:** The app is recoverable, understandable, accessible, and stable enough to be considered the completed v2 baseline.
