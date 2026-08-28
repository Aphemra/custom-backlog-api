import type { CollectionSummary } from "../../../domain/collection";
import {
  playStationPlatforms,
  playStatuses,
  playStatusLabels,
  type PlayStationPlatform,
  type PlayStatus,
} from "../../../domain/libraryGame";
import {
  hiddenModeLabels,
  savedViewSortLabels,
  type HiddenMode,
  type SavedViewFilters,
  type SavedViewSort,
  type SavedViewSortField,
  type SortDirection,
} from "../../../domain/savedView";

const sortFields: readonly SavedViewSortField[] = [
  "priorityRank",
  "title",
  "platform",
  "playStatus",
  "createdAt",
  "updatedAt",
  "progressPercent",
  "lastSyncedAt",
  "alertCreatedAt",
];

type BooleanFilterValue = "" | "true" | "false";

type AlertKind = "new_trophies" | "completion_lost";

function toggleValue<T>(values: readonly T[], value: T): readonly T[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function readBooleanFilter(value: string): boolean | undefined {
  if (value === "") {
    return undefined;
  }

  return value === "true";
}

function displayBooleanFilter(value: boolean | undefined): BooleanFilterValue {
  if (value === undefined) {
    return "";
  }

  return value ? "true" : "false";
}

function displayAlertKind(
  alertKinds: SavedViewFilters["alertKinds"],
): "" | AlertKind {
  return alertKinds?.length === 1 ? alertKinds[0] : "";
}

interface LibraryFilterPanelProps {
  readonly filters: SavedViewFilters;

  readonly sort: SavedViewSort;

  readonly collections: readonly CollectionSummary[];

  readonly adjusted: boolean;

  readonly busy: boolean;

  readonly newViewName: string;

  readonly showCompletedAction: boolean;

  readonly completedOrderNeedsNormalization: boolean;

  readonly onFiltersChange: (filters: SavedViewFilters) => void;

  readonly onSortChange: (sort: SavedViewSort) => void;

  readonly onReset: () => void;

  readonly onNewViewNameChange: (name: string) => void;

  readonly onCreateView: () => void;

  readonly onMoveCompletedToBottom: () => void;
}

export function LibraryFilterPanel({
  filters,
  sort,
  collections,
  adjusted,
  busy,
  newViewName,
  showCompletedAction,
  completedOrderNeedsNormalization,
  onFiltersChange,
  onSortChange,
  onReset,
  onNewViewNameChange,
  onCreateView,
  onMoveCompletedToBottom,
}: LibraryFilterPanelProps) {
  function togglePlatform(platform: PlayStationPlatform) {
    const platforms = toggleValue(filters.platforms ?? [], platform);

    onFiltersChange({
      ...filters,
      platforms: platforms.length === 0 ? undefined : platforms,
    });
  }

  function togglePlayStatus(playStatus: PlayStatus) {
    const playStatuses = toggleValue(filters.playStatuses ?? [], playStatus);

    onFiltersChange({
      ...filters,
      playStatuses: playStatuses.length === 0 ? undefined : playStatuses,
    });
  }

  function toggleCollection(collectionId: string) {
    const collectionIds = toggleValue(
      filters.collectionIds ?? [],
      collectionId,
    );

    onFiltersChange({
      ...filters,
      collectionIds: collectionIds.length === 0 ? undefined : collectionIds,
    });
  }

  return (
    <section
      id="library-filter-panel"
      className="library-filter-panel"
      aria-labelledby="library-filter-panel-title"
    >
      <div className="library-filter-panel__heading">
        <div>
          <p className="eyebrow">Filters and order</p>

          <h3 id="library-filter-panel-title">Configure this Library view</h3>

          <p>
            Changes apply immediately but remain temporary until saved as a new
            view.
          </p>
        </div>

        <button
          className="button button--quiet"
          type="button"
          disabled={!adjusted || busy}
          onClick={onReset}
        >
          Reset filters
        </button>
      </div>

      <div className="library-filter-panel__grid">
        <fieldset className="library-filter-panel__group">
          <legend>Platforms</legend>

          <div className="filter-checks filter-checks--compact">
            {playStationPlatforms.map((platform) => (
              <label key={platform}>
                <input
                  type="checkbox"
                  checked={filters.platforms?.includes(platform) ?? false}
                  onChange={() => togglePlatform(platform)}
                />

                <span>{platform}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="library-filter-panel__group">
          <legend>Play status</legend>

          <div className="filter-checks">
            {playStatuses.map((playStatus) => (
              <label key={playStatus}>
                <input
                  type="checkbox"
                  checked={filters.playStatuses?.includes(playStatus) ?? false}
                  onChange={() => togglePlayStatus(playStatus)}
                />

                <span>{playStatusLabels[playStatus]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="library-filter-panel__group">
          <legend>Collections</legend>

          {collections.length === 0 ? (
            <p className="library-filter-panel__empty">
              No Collections exist yet.
            </p>
          ) : (
            <div className="filter-checks filter-checks--collections">
              {collections.map((collection) => (
                <label key={collection.id}>
                  <input
                    type="checkbox"
                    checked={
                      filters.collectionIds?.includes(collection.id) ?? false
                    }
                    onChange={() => toggleCollection(collection.id)}
                  />

                  <span>{collection.name}</span>
                </label>
              ))}
            </div>
          )}

          <small>Games may belong to any selected Collection.</small>
        </fieldset>

        <div className="library-filter-panel__selects">
          <label className="field">
            <span>Hidden games</span>

            <select
              value={filters.hiddenMode ?? "visible"}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  hiddenMode: event.target.value as HiddenMode,
                })
              }
            >
              {Object.entries(hiddenModeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Platinum earned</span>

            <select
              value={displayBooleanFilter(filters.platinumEarned)}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  platinumEarned: readBooleanFilter(event.target.value),
                })
              }
            >
              <option value="">Any trophy state</option>
              <option value="true">Platinum earned</option>
              <option value="false">Platinum not earned</option>
            </select>
          </label>

          <label className="field">
            <span>100% completion</span>

            <select
              value={displayBooleanFilter(filters.is100Percent)}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  is100Percent: readBooleanFilter(event.target.value),
                })
              }
            >
              <option value="">Any completion</option>
              <option value="true">100% complete</option>
              <option value="false">Below 100%</option>
            </select>
          </label>

          <label className="field">
            <span>Synchronization state</span>

            <select
              value={displayBooleanFilter(filters.needsSync)}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  needsSync: readBooleanFilter(event.target.value),
                })
              }
            >
              <option value="">Any sync state</option>
              <option value="true">Needs first sync</option>
              <option value="false">Already synchronized or unlinked</option>
            </select>
          </label>

          <label className="field">
            <span>Trophy alert type</span>

            <select
              value={displayAlertKind(filters.alertKinds)}
              onChange={(event) => {
                const alertKind = event.target.value as "" | AlertKind;

                onFiltersChange({
                  ...filters,
                  alertKinds: alertKind === "" ? undefined : [alertKind],
                });
              }}
            >
              <option value="">Any alert type</option>
              <option value="new_trophies">New trophies</option>
              <option value="completion_lost">Completion lost</option>
            </select>
          </label>

          <label className="field">
            <span>Trophy alert status</span>

            <select
              value={filters.alertStatus ?? ""}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  alertStatus:
                    event.target.value === ""
                      ? undefined
                      : (event.target.value as NonNullable<
                          SavedViewFilters["alertStatus"]
                        >),
                })
              }
            >
              <option value="">Any alert status</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </label>

          <label className="field">
            <span>Order results by</span>

            <select
              value={sort.field}
              onChange={(event) =>
                onSortChange({
                  ...sort,
                  field: event.target.value as SavedViewSortField,
                })
              }
            >
              {sortFields.map((field) => (
                <option key={field} value={field}>
                  {savedViewSortLabels[field]}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Direction</span>

            <select
              value={sort.direction}
              onChange={(event) =>
                onSortChange({
                  ...sort,
                  direction: event.target.value as SortDirection,
                })
              }
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>
        </div>
      </div>

      <div className="library-filter-panel__actions">
        <label className="field library-filter-panel__save-field">
          <span>Save current filters as a new view</span>

          <input
            type="text"
            maxLength={100}
            value={newViewName}
            onChange={(event) => onNewViewNameChange(event.target.value)}
            placeholder="View name"
          />
        </label>

        <button
          className="button button--primary"
          type="button"
          disabled={busy || newViewName.trim().length === 0}
          onClick={onCreateView}
        >
          {busy ? "Saving…" : "Save as new view"}
        </button>

        {showCompletedAction ? (
          <button
            className="button button--quiet"
            type="button"
            disabled={!completedOrderNeedsNormalization || busy}
            onClick={onMoveCompletedToBottom}
          >
            {completedOrderNeedsNormalization
              ? "Move completed to bottom"
              : "Completed games already at bottom"}
          </button>
        ) : null}
      </div>
    </section>
  );
}
