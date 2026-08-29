import { useMemo, useState } from "react";
import { SortableList } from "../../../components/sortable/SortableList";
import { IconButton } from "../../../components/ui/IconButton";
import { CloseIcon } from "../../../components/ui/icons";
import type { CollectionDetail } from "../../../domain/collection";
import {
  playStatusLabels,
  type LibraryGame,
} from "../../../domain/libraryGame";

function normalizeSearchText(value: string) {
  const spaced = value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    spaced,
    compact: spaced.replace(/\s+/g, ""),
  };
}

function matchesSearch(title: string, searchQuery: string): boolean {
  const search = normalizeSearchText(searchQuery);

  if (search.spaced.length === 0) {
    return true;
  }

  const normalizedTitle = normalizeSearchText(title);

  return (
    normalizedTitle.spaced.includes(search.spaced) ||
    normalizedTitle.compact.includes(search.compact)
  );
}

function sameGameOrder(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((gameId, index) => gameId === right[index])
  );
}

interface CollectionGameEditorProps {
  readonly collection: CollectionDetail;
  readonly libraryGames: readonly LibraryGame[];
  readonly onSave: (orderedGameIds: readonly string[]) => Promise<void>;
  readonly onClose: () => void;
}

export function CollectionGameEditor({
  collection,
  libraryGames,
  onSave,
  onClose,
}: CollectionGameEditorProps) {
  const initialGameIds = useMemo(
    () => collection.games.map((game) => game.id),
    [collection.games],
  );

  const [orderedGameIds, setOrderedGameIds] =
    useState<readonly string[]>(initialGameIds);

  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges = !sameGameOrder(initialGameIds, orderedGameIds);

  const gamesById = useMemo(
    () => new Map(libraryGames.map((game) => [game.id, game])),
    [libraryGames],
  );

  const selectedGames = useMemo(
    () =>
      orderedGameIds.flatMap((gameId) => {
        const game = gamesById.get(gameId);

        return game === undefined ? [] : [game];
      }),
    [gamesById, orderedGameIds],
  );

  const visibleLibraryGames = useMemo(
    () => libraryGames.filter((game) => matchesSearch(game.title, searchQuery)),
    [libraryGames, searchQuery],
  );

  function toggleGame(gameId: string) {
    setOrderedGameIds((currentIds) =>
      currentIds.includes(gameId)
        ? currentIds.filter((candidateId) => candidateId !== gameId)
        : [...currentIds, gameId],
    );
  }

  async function saveChanges() {
    if (!hasChanges) {
      return;
    }

    setIsSaving(true);

    try {
      await onSave(orderedGameIds);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="membership-editor">
      <div className="membership-editor__section">
        <div className="membership-editor__section-heading">
          <h3>Selected games</h3>
          <span>{selectedGames.length}</span>
        </div>

        {selectedGames.length === 0 ? (
          <p className="membership-editor__empty">No games selected yet.</p>
        ) : (
          <div className="selected-game-list">
            <SortableList
              items={selectedGames}
              disabled={isSaving}
              ariaLabel={`Games in ${collection.name}`}
              getItemLabel={(game) => game.title}
              onReorder={(reorderedGames) => {
                setOrderedGameIds(reorderedGames.map((game) => game.id));
              }}
              renderItem={(game, controls) => (
                <div className="selected-game">
                  <div className="selected-game__order">
                    {controls.dragHandle}

                    <span className="order-number">{controls.position}</span>
                  </div>

                  <div className="selected-game__identity">
                    <strong>{game.title}</strong>

                    <span>
                      {game.platform} · {playStatusLabels[game.playStatus]}
                      {game.hiddenAt === null ? "" : " · Hidden"}
                    </span>
                  </div>

                  <IconButton
                    label={`Remove ${game.title} from ${collection.name}`}
                    tooltip="Remove from Collection"
                    tooltipPlacement="top"
                    tooltipAlignment="end"
                    icon={<CloseIcon />}
                    tone="danger"
                    disabled={isSaving}
                    onClick={() => toggleGame(game.id)}
                  />
                </div>
              )}
            />
          </div>
        )}
      </div>

      <div className="membership-editor__section">
        <div className="membership-editor__section-heading">
          <h3>Library</h3>

          <span>
            {visibleLibraryGames.length} of {libraryGames.length} games
          </span>
        </div>

        <label className="search-field">
          <span className="visually-hidden">Search games to add</span>

          <input
            data-dialog-initial-focus
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search games to add…"
          />
        </label>

        <div className="membership-picker">
          {visibleLibraryGames.length === 0 ? (
            <p className="membership-editor__empty">
              No Library games match this search.
            </p>
          ) : (
            visibleLibraryGames.map((game) => (
              <label className="membership-option" key={game.id}>
                <input
                  type="checkbox"
                  checked={orderedGameIds.includes(game.id)}
                  disabled={isSaving}
                  onChange={() => toggleGame(game.id)}
                />

                <span className="membership-option__identity">
                  <strong>{game.title}</strong>

                  <small>
                    {game.platform} · {playStatusLabels[game.playStatus]}
                    {game.hiddenAt === null ? "" : " · Hidden"}
                  </small>
                </span>
              </label>
            ))
          )}
        </div>
      </div>

      <div className="form-actions membership-editor__actions">
        <button
          className="button button--quiet"
          type="button"
          onClick={onClose}
        >
          Cancel
        </button>

        <button
          className="button button--primary"
          type="button"
          disabled={isSaving || !hasChanges}
          onClick={() => void saveChanges()}
        >
          {isSaving
            ? "Saving…"
            : hasChanges
              ? "Save game list"
              : "No changes to save"}
        </button>
      </div>
    </div>
  );
}
