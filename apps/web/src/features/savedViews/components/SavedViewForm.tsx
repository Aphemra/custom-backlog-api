import { useState, type FormEvent } from "react";
import { IconButton } from "../../../components/ui/IconButton";
import { CloseIcon } from "../../../components/ui/icons";
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
  type SavedView,
  type SavedViewInput,
  type SavedViewSortField,
  type SortDirection,
} from "../../../domain/savedView";

const currentSortFields: readonly SavedViewSortField[] = [
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

function toBooleanFilterValue(value: boolean | undefined): BooleanFilterValue {
  if (value === undefined) {
    return "";
  }

  return value ? "true" : "false";
}

function fromBooleanFilterValue(
  value: BooleanFilterValue,
): boolean | undefined {
  if (value === "") {
    return undefined;
  }

  return value === "true";
}

interface SavedViewFormProps {
  readonly initialView?: SavedView;

  readonly collections: readonly CollectionSummary[];

  readonly onSubmit: (input: SavedViewInput) => Promise<void>;

  readonly onCancel: () => void;
}

function toggleValue<T>(values: readonly T[], value: T): readonly T[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export function SavedViewForm({
  initialView,
  collections,
  onSubmit,
  onCancel,
}: SavedViewFormProps) {
  const [name, setName] = useState(initialView?.name ?? "");

  const [search, setSearch] = useState(initialView?.filters.search ?? "");

  const [platforms, setPlatforms] = useState<readonly PlayStationPlatform[]>(
    initialView?.filters.platforms ?? [],
  );

  const [statuses, setStatuses] = useState<readonly PlayStatus[]>(
    initialView?.filters.playStatuses ?? [],
  );

  const [hiddenMode, setHiddenMode] = useState<HiddenMode>(
    initialView?.filters.hiddenMode ?? "visible",
  );

  const [collectionIds, setCollectionIds] = useState<readonly string[]>(
    initialView?.filters.collectionIds ?? [],
  );

  const [platinumEarned, setPlatinumEarned] = useState<BooleanFilterValue>(
    toBooleanFilterValue(initialView?.filters.platinumEarned),
  );

  const [is100Percent, setIs100Percent] = useState<BooleanFilterValue>(
    toBooleanFilterValue(initialView?.filters.is100Percent),
  );

  const [needsSync, setNeedsSync] = useState<BooleanFilterValue>(
    toBooleanFilterValue(initialView?.filters.needsSync),
  );

  const [sortField, setSortField] = useState<SavedViewSortField>(
    initialView?.sort.field ?? "priorityRank",
  );

  const [sortDirection, setSortDirection] = useState<SortDirection>(
    initialView?.sort.direction ?? "asc",
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit({
        name: name.trim(),

        filters: {
          ...initialView?.filters,

          search: search.trim().length === 0 ? undefined : search.trim(),

          platforms: platforms.length === 0 ? undefined : platforms,

          playStatuses: statuses.length === 0 ? undefined : statuses,

          hiddenMode,

          collectionIds: collectionIds.length === 0 ? undefined : collectionIds,

          platinumEarned: fromBooleanFilterValue(platinumEarned),

          is100Percent: fromBooleanFilterValue(is100Percent),

          needsSync: fromBooleanFilterValue(needsSync),
        },

        sort: {
          field: sortField,
          direction: sortDirection,
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="saved-view-form" onSubmit={handleSubmit}>
      <div className="game-form__heading">
        <div>
          <p className="eyebrow">
            {initialView === undefined ? "New saved view" : "Edit saved view"}
          </p>

          <h2>{initialView?.name ?? "Create a reusable backlog view"}</h2>
        </div>

        <IconButton
          label="Close Saved View editor"
          icon={<CloseIcon />}
          onClick={onCancel}
        />
      </div>

      <div className="saved-view-form__grid">
        <label className="field field--wide">
          <span>Name</span>

          <input
            autoFocus
            required
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="PS5 games to pursue, Short platinums…"
          />
        </label>

        <label className="field field--wide">
          <span>Saved title or notes search</span>

          <input
            maxLength={200}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Optional words every result must match"
          />
        </label>

        <fieldset className="saved-view-form__group">
          <legend>Platforms</legend>

          <div className="filter-checks filter-checks--compact">
            {playStationPlatforms.map((platform) => (
              <label key={platform}>
                <input
                  type="checkbox"
                  checked={platforms.includes(platform)}
                  onChange={() =>
                    setPlatforms(toggleValue(platforms, platform))
                  }
                />

                <span>{platform}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="saved-view-form__group">
          <legend>Play status</legend>

          <div className="filter-checks">
            {playStatuses.map((status) => (
              <label key={status}>
                <input
                  type="checkbox"
                  checked={statuses.includes(status)}
                  onChange={() => setStatuses(toggleValue(statuses, status))}
                />

                <span>{playStatusLabels[status]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="field">
          <span>Hidden games</span>

          <select
            value={hiddenMode}
            onChange={(event) =>
              setHiddenMode(event.target.value as HiddenMode)
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
            value={platinumEarned}
            onChange={(event) =>
              setPlatinumEarned(event.target.value as BooleanFilterValue)
            }
          >
            <option value="">Any</option>
            <option value="true">Earned</option>
            <option value="false">Not earned</option>
          </select>
        </label>

        <label className="field">
          <span>100% completion</span>

          <select
            value={is100Percent}
            onChange={(event) =>
              setIs100Percent(event.target.value as BooleanFilterValue)
            }
          >
            <option value="">Any</option>
            <option value="true">Complete</option>
            <option value="false">Incomplete</option>
          </select>
        </label>

        <label className="field">
          <span>Synchronization state</span>

          <select
            value={needsSync}
            onChange={(event) =>
              setNeedsSync(event.target.value as BooleanFilterValue)
            }
          >
            <option value="">Any</option>
            <option value="true">Needs first sync</option>
            <option value="false">Does not need first sync</option>
          </select>
        </label>

        <fieldset className="saved-view-form__group">
          <legend>Collections</legend>

          {collections.length === 0 ? (
            <p className="saved-view-form__empty">No Collections exist yet.</p>
          ) : (
            <div className="filter-checks filter-checks--collections">
              {collections.map((collection) => (
                <label key={collection.id}>
                  <input
                    type="checkbox"
                    checked={collectionIds.includes(collection.id)}
                    onChange={() =>
                      setCollectionIds(
                        toggleValue(collectionIds, collection.id),
                      )
                    }
                  />

                  <span>{collection.name}</span>
                </label>
              ))}
            </div>
          )}

          <small>Games may belong to any selected Collection.</small>
        </fieldset>

        <label className="field">
          <span>Order results by</span>

          <select
            value={sortField}
            onChange={(event) =>
              setSortField(event.target.value as SavedViewSortField)
            }
          >
            {currentSortFields.map((field) => (
              <option key={field} value={field}>
                {savedViewSortLabels[field]}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Direction</span>

          <select
            value={sortDirection}
            onChange={(event) =>
              setSortDirection(event.target.value as SortDirection)
            }
          >
            <option value="asc">Ascending</option>

            <option value="desc">Descending</option>
          </select>
        </label>
      </div>

      <div className="form-actions">
        <button
          className="button button--quiet"
          type="button"
          onClick={onCancel}
        >
          Cancel
        </button>

        <button
          className="button button--primary"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "Saving…"
            : initialView === undefined
              ? "Create saved view"
              : "Save changes"}
        </button>
      </div>
    </form>
  );
}
