import { useEffect, useMemo, useState } from "react";
import type {
  CreateLibraryGameInput,
  LibraryGame,
  LibraryGameWithArtwork,
} from "../../../domain/libraryGame";
import { ApiError } from "../../../services/api/apiClient";
import { libraryApi } from "../../../services/api/libraryApi";
import { IgdbGameSearch } from "../components/IgdbGameSearch";
import { LibraryGameForm } from "../components/LibraryGameForm";
import { LibraryGameRow } from "../components/LibraryGameRow";

type LoadState = "loading" | "ready" | "error";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "Something unexpected went wrong while updating the library.";
}

export function LibraryPage() {
  const [games, setGames] = useState<readonly LibraryGameWithArtwork[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isSearchingIgdb, setIsSearchingIgdb] = useState(false);
  const [editingGame, setEditingGame] = useState<LibraryGame | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    async function loadLibrary() {
      try {
        const loadedGames = await libraryApi.list(abortController.signal);

        if (!abortController.signal.aborted) {
          setGames(loadedGames);
          setLoadState("ready");
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          setErrorMessage(getErrorMessage(error));
          setLoadState("error");
        }
      }
    }

    void loadLibrary();

    return () => abortController.abort();
  }, []);

  const orderedVisibleGames = useMemo(
    () => games.filter((game) => game.hiddenAt === null),
    [games],
  );

  const hiddenGames = useMemo(
    () => games.filter((game) => game.hiddenAt !== null),
    [games],
  );

  const visibleGames = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase("en-US");

    return games.filter((game) => {
      if (!showHidden && game.hiddenAt !== null) {
        return false;
      }

      if (normalizedQuery.length === 0) {
        return true;
      }

      return (
        game.title.toLocaleLowerCase("en-US").includes(normalizedQuery) ||
        game.notes?.toLocaleLowerCase("en-US").includes(normalizedQuery) ===
          true
      );
    });
  }, [games, searchQuery, showHidden]);

  const orderingDisabled = searchQuery.trim().length > 0;

  async function refreshGames(): Promise<void> {
    setGames(await libraryApi.list());
  }

  async function performMutation(
    key: string,
    successMessage: string,
    action: () => Promise<unknown>,
  ): Promise<boolean> {
    setBusyKey(key);
    setErrorMessage(null);
    setNotice(null);

    try {
      await action();
      await refreshGames();
      setNotice(successMessage);
      return true;
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      return false;
    } finally {
      setBusyKey(null);
    }
  }

  async function handleCreate(input: CreateLibraryGameInput): Promise<void> {
    const succeeded = await performMutation(
      "create",
      `${input.title} was added.`,
      () => libraryApi.create(input),
    );

    if (succeeded) {
      setIsAdding(false);
    }
  }

  async function handleIgdbAdded(game: LibraryGame): Promise<void> {
    await refreshGames();
    setErrorMessage(null);
    setNotice(`${game.title} was added from IGDB.`);
  }

  async function handleUpdate(input: CreateLibraryGameInput): Promise<void> {
    if (editingGame === null) {
      return;
    }

    const succeeded = await performMutation(
      editingGame.id,
      `${input.title} was updated.`,
      () => libraryApi.update(editingGame.id, input),
    );

    if (succeeded) {
      setEditingGame(null);
    }
  }

  async function handleHide(game: LibraryGame): Promise<void> {
    const succeeded = await performMutation(
      game.id,
      `${game.title} was hidden.`,
      () => libraryApi.hide(game.id),
    );

    if (succeeded && editingGame?.id === game.id) {
      setEditingGame(null);
    }
  }

  async function handleUnhide(game: LibraryGame): Promise<void> {
    await performMutation(
      game.id,
      `${game.title} is visible in the library again.`,
      () => libraryApi.unhide(game.id),
    );
  }

  async function handleDelete(game: LibraryGame): Promise<void> {
    const confirmed = window.confirm(
      `Permanently delete ${game.title}? This also deletes its future local trophy history and cannot be undone without a backup.`,
    );

    if (!confirmed) {
      return;
    }

    const succeeded = await performMutation(
      game.id,
      `${game.title} was permanently deleted.`,
      () => libraryApi.deletePermanently(game.id),
    );

    if (succeeded && editingGame?.id === game.id) {
      setEditingGame(null);
    }
  }

  async function moveGame(gameId: string, direction: -1 | 1): Promise<void> {
    const currentIndex = orderedVisibleGames.findIndex(
      (game) => game.id === gameId,
    );
    const targetIndex = currentIndex + direction;

    if (
      currentIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= orderedVisibleGames.length
    ) {
      return;
    }

    const reorderedGames = [...orderedVisibleGames];
    const [movedGame] = reorderedGames.splice(currentIndex, 1);

    if (movedGame === undefined) {
      return;
    }

    reorderedGames.splice(targetIndex, 0, movedGame);

    await performMutation("order", "Library order was updated.", () =>
      libraryApi.reorder(reorderedGames.map((game) => game.id)),
    );
  }

  function openAddForm() {
    setIsSearchingIgdb(false);
    setEditingGame(null);
    setIsAdding(true);
    setErrorMessage(null);
  }

  function openIgdbSearch() {
    setIsAdding(false);
    setEditingGame(null);
    setIsSearchingIgdb(true);
    setErrorMessage(null);
    setNotice(null);
  }

  function openEditForm(game: LibraryGame) {
    setIsAdding(false);
    setIsSearchingIgdb(false);
    setEditingGame(game);
    setErrorMessage(null);
  }

  function closeForm() {
    setIsAdding(false);
    setEditingGame(null);
  }

  return (
    <section className="library-page" aria-labelledby="library-title">
      <div className="library-heading">
        <div>
          <p className="eyebrow">Canonical library</p>
          <h2 id="library-title">Your trophy backlog</h2>
          <p className="library-heading__description">
            One game entry, any number of future collections and saved views.
          </p>
        </div>

        <div className="library-heading__actions">
          <button
            className="button button--quiet"
            type="button"
            onClick={openAddForm}
          >
            Add manually
          </button>

          <button
            className="button button--primary"
            type="button"
            onClick={openIgdbSearch}
          >
            Search IGDB
          </button>
        </div>
      </div>

      <div className="stats-strip" aria-label="Library summary">
        <div>
          <strong>{orderedVisibleGames.length}</strong>
          <span>Visible games</span>
        </div>

        <div>
          <strong>
            {
              orderedVisibleGames.filter(
                (game) => game.playStatus === "not_started",
              ).length
            }
          </strong>
          <span>Not started</span>
        </div>

        <div>
          <strong>
            {
              orderedVisibleGames.filter(
                (game) => game.playStatus === "playing",
              ).length
            }
          </strong>
          <span>Playing</span>
        </div>

        <div>
          <strong>{hiddenGames.length}</strong>
          <span>Hidden</span>
        </div>
      </div>

      <div className="library-controls">
        <label className="search-field">
          <span className="visually-hidden">Search library</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search titles or notes…"
          />
        </label>

        <label className="checkbox-control">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(event) => setShowHidden(event.target.checked)}
          />
          <span>Show hidden games</span>
        </label>
      </div>

      {orderingDisabled ? (
        <p className="helper-message">
          Clear the search to change the full library order.
        </p>
      ) : null}

      {notice === null ? null : (
        <div className="notice notice--success" role="status">
          {notice}
        </div>
      )}

      {errorMessage === null ? null : (
        <div className="notice notice--error" role="alert">
          {errorMessage}
        </div>
      )}

      {isSearchingIgdb ? (
        <div className="editor-panel">
          <IgdbGameSearch
            onAdded={handleIgdbAdded}
            onClose={() => setIsSearchingIgdb(false)}
          />
        </div>
      ) : null}

      {isAdding || editingGame !== null ? (
        <div className="editor-panel">
          <LibraryGameForm
            key={editingGame?.id ?? "new-game"}
            initialGame={editingGame ?? undefined}
            onSubmit={editingGame === null ? handleCreate : handleUpdate}
            onCancel={closeForm}
          />
        </div>
      ) : null}

      {loadState === "loading" ? (
        <div className="empty-state" role="status">
          <h3>Loading your library…</h3>
        </div>
      ) : null}

      {loadState === "error" ? (
        <div className="empty-state">
          <h3>The library could not be loaded.</h3>
          <p>Check that the local API is running, then reload this page.</p>
        </div>
      ) : null}

      {loadState === "ready" && visibleGames.length === 0 ? (
        <div className="empty-state">
          <h3>
            {games.length === 0
              ? "Your library is ready."
              : "No games match this view."}
          </h3>
          <p>
            {games.length === 0
              ? "Search IGDB for automatic metadata, or create a manual entry."
              : "Try clearing the search or showing archived entries."}
          </p>
          {games.length === 0 ? (
            <button
              className="button button--primary"
              type="button"
              onClick={openIgdbSearch}
            >
              Search for your first game
            </button>
          ) : null}
        </div>
      ) : null}

      {loadState === "ready" && visibleGames.length > 0 ? (
        <div className="game-list" aria-label="Library games">
          {visibleGames.map((game) => {
            const activeIndex = orderedVisibleGames.findIndex(
              (candidate) => candidate.id === game.id,
            );
            const isHidden = game.hiddenAt !== null;

            return (
              <LibraryGameRow
                key={game.id}
                game={game}
                position={isHidden ? null : activeIndex + 1}
                canMoveUp={!isHidden && activeIndex > 0}
                canMoveDown={
                  !isHidden && activeIndex < orderedVisibleGames.length - 1
                }
                orderingDisabled={orderingDisabled}
                busy={busyKey !== null}
                onMoveUp={() => void moveGame(game.id, -1)}
                onMoveDown={() => void moveGame(game.id, 1)}
                onEdit={() => openEditForm(game)}
                onHide={() => void handleHide(game)}
                onUnhide={() => void handleUnhide(game)}
                onDelete={() => void handleDelete(game)}
              />
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
