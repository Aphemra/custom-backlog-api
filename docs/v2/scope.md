# V2 product scope

## Product goal

Provide one person with a fast, attractive, local-first application for
organizing PlayStation trophy pursuits and noticing meaningful changes in
trophy progress.

The interface should prioritize useful information at a glance without
turning the library into a dense spreadsheet.

## Required capabilities

- Support trophy-bearing PS3, PS4, and PS5 games.
- Import trophy progress from a PlayStation account with minimal effort.
- Search for games and add them to one canonical library.
- Attach metadata and artwork automatically where possible.
- Organize games into manually curated collections.
- Reorder games and collections.
- Create reusable filtered and sorted views of the library.
- Track intended pursuits, active pursuits, completed platinums, and 100%
  completion.
- Export and restore all important local data from files.
- Detect changes to previously synchronized trophy data.
- Highlight games that lost 100% completion because additional trophies
  were published.
- Work especially well on a vertical desktop monitor.
- Remain usable at narrower screen sizes.

## Vocabulary

### Library

The single canonical collection of games known to the application. A game is
stored once regardless of how many views or collections contain it.

### Saved view

A named set of filters and sorting rules applied to the library. Saved views
replace the idea of maintaining multiple duplicated backlogs.

### Collection

A manually curated, ordered group of games. This replaces the ambiguous
v1 term "bucket." A game may belong to multiple collections.

### Trophy snapshot

A timestamped record of trophy totals and the user's earned progress for a
game. Snapshots allow the application to detect changes.

### Alert

A meaningful change derived from comparing snapshots, such as a completed
game receiving additional trophies.

## Initial built-in views

- All games
- Pursuing soon
- In progress
- Platinum earned
- 100% complete
- Completion lost
- Needs synchronization

Users may later save additional views.

## Explicit non-goals

- Public accounts or multi-user authentication
- Social feeds, comments, likes, or public profiles
- Competitive leaderboards
- Trophy guides
- Price tracking
- Storefront purchasing
- Automatic remote hosting
- Synchronizing arbitrary data between devices
- Supporting games without trophies
- Using PlayStation Network as a writable service
