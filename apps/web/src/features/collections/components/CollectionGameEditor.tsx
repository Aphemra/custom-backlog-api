import { useMemo, useState } from "react";
import type { CollectionDetail } from "../../../domain/collection";
import {
  playStatusLabels,
  type LibraryGame,
} from "../../../domain/libraryGame";

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
  const [orderedGameIds, setOrderedGameIds] = useState<readonly string[]>(
    collection.games.map((game) => game.id),
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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

  const visibleLibraryGames = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("en-US");

    return libraryGames.filter(
      (game) =>
        query.length === 0 ||
        game.title.toLocaleLowerCase("en-US").includes(query),
    );
  }, [libraryGames, searchQuery]);

  function toggleGame(gameId: string) {
    setOrderedGameIds((currentIds) =>
      currentIds.includes(gameId)
        ? currentIds.filter((candidateId) => candidateId !== gameId)
        : [...currentIds, gameId],
    );
  }

  function moveGame(gameId: string, direction: -1 | 1) {
    setOrderedGameIds((currentIds) => {
      const currentIndex = currentIds.indexOf(gameId);
      const targetIndex = currentIndex + direction;

      if (
        currentIndex < 0 ||
        targetIndex < 0 ||
        targetIndex >= currentIds.length
      ) {
        return currentIds;
      }

      const reorderedIds = [...currentIds];

      const [movedId] = reorderedIds.splice(currentIndex, 1);

      if (movedId === undefined) {
        return currentIds;
      }

      reorderedIds.splice(targetIndex, 0, movedId);

      return reorderedIds;
    });
  }

  async function saveChanges() {
    setIsSaving(true);

    try {
      await onSave(orderedGameIds);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section
      className="membership-editor"
      aria-labelledby="membership-editor-title"
    >
      <div className="game-form__heading">
        <div>
          <p className="eyebrow">Collection membership</p>

          <h2 id="membership-editor-title">Games in {collection.name}</h2>

          <p className="membership-editor__intro">
            Select games below, then arrange the selected list in the order you
            want to see it.
          </p>
        </div>

        <button
          className="icon-button"
          type="button"
          onClick={onClose}
          aria-label="Close game manager"
        >
          ×
        </button>
      </div>

      <div className="membership-editor__section">
        <div className="membership-editor__section-heading">
          <h3>Selected games</h3>
          <span>{selectedGames.length}</span>
        </div>

        {selectedGames.length === 0 ? (
          <p className="membership-editor__empty">No games selected yet.</p>
        ) : (
          <div className="selected-game-list">
            {selectedGames.map((game, index) => (
              <div className="selected-game" key={game.id}>
                <div className="selected-game__order">
                  <button
                    className="order-button"
                    type="button"
                    disabled={isSaving || index === 0}
                    onClick={() => moveGame(game.id, -1)}
                    aria-label={`Move ${game.title} up`}
                  >
                    ↑
                  </button>

                  <span className="order-number">{index + 1}</span>

                  <button
                    className="order-button"
                    type="button"
                    disabled={isSaving || index === selectedGames.length - 1}
                    onClick={() => moveGame(game.id, 1)}
                    aria-label={`Move ${game.title} down`}
                  >
                    ↓
                  </button>
                </div>

                <div className="selected-game__identity">
                  <strong>{game.title}</strong>

                  <span>
                    {game.platform} · {playStatusLabels[game.playStatus]}
                    {game.hiddenAt === null ? "" : " · Hidden"}
                  </span>
                </div>

                <button
                  className="text-button text-button--danger"
                  type="button"
                  disabled={isSaving}
                  onClick={() => toggleGame(game.id)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="membership-editor__section">
        <div className="membership-editor__section-heading">
          <h3>Library</h3>
          <span>{libraryGames.length} games</span>
        </div>

        <label className="search-field">
          <span className="visually-hidden">Search games to add</span>

          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search games to add…"
          />
        </label>

        <div className="membership-picker">
          {visibleLibraryGames.map((game) => (
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
          ))}
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
          disabled={isSaving}
          onClick={() => void saveChanges()}
        >
          {isSaving ? "Saving…" : "Save game list"}
        </button>
      </div>
    </section>
  );
}
