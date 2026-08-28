import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { useToast } from "../../../components/toast/useToast";
import type {
  CreateLibraryGameInput,
  LibraryGame,
  LibraryGameListItem,
} from "../../../domain/libraryGame";
import type { PlayStationProgressSynchronizationResponse } from "../../../domain/playStation";
import { ApiError } from "../../../services/api/apiClient";
import { libraryApi } from "../../../services/api/libraryApi";
import { playStationApi } from "../../../services/api/playStationApi";
import { PlayStationSyncProgressPanel } from "../../playstation/components/PlayStationSyncProgressPanel";
import { usePlayStationSyncProgress } from "../../playstation/hooks/usePlayStationSyncProgress";
import { IgdbGameSearch } from "../components/IgdbGameSearch";
import { LibraryGameForm } from "../components/LibraryGameForm";
import { LibraryGameRow } from "../components/LibraryGameRow";

type LoadState = "loading" | "ready" | "error";

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "Something unexpected went wrong while updating the library.";
}

export function LibraryPage() {
  const { showToast } = useToast();

  const [games, setGames] = useState<readonly LibraryGameListItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isSearchingIgdb, setIsSearchingIgdb] = useState(false);
  const [editingGame, setEditingGame] = useState<LibraryGame | null>(null);
  const [gamePendingDeletion, setGamePendingDeletion] =
    useState<LibraryGame | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [isSynchronizingTrophies, setIsSynchronizingTrophies] = useState(false);
  const [lastProgressSync, setLastProgressSync] =
    useState<PlayStationProgressSynchronizationResponse | null>(null);
  const { syncProgress, refreshSyncProgress } = usePlayStationSyncProgress(
    isSynchronizingTrophies,
  );
  const synchronizationActive =
    isSynchronizingTrophies || syncProgress?.status === "running";

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

  useEffect(() => {
    if (
      syncProgress?.status !== "succeeded" ||
      syncProgress.finishedAt === null
    ) {
      return;
    }

    void refreshGames().catch((error: unknown) => {
      setErrorMessage(getErrorMessage(error));
    });
  }, [syncProgress?.finishedAt, syncProgress?.status]);

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

  const latestStoredTrophyUpdate = useMemo(() => {
    let latest: string | null = null;

    for (const game of games) {
      const candidate = game.trophySummary?.lastSyncedAt;

      if (
        candidate !== undefined &&
        (latest === null || Date.parse(candidate) > Date.parse(latest))
      ) {
        latest = candidate;
      }
    }

    return latest;
  }, [games]);

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

    try {
      await action();
      await refreshGames();

      showToast({
        tone: "success",
        message: successMessage,
      });

      return true;
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      return false;
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSyncTrophyProgress(): Promise<void> {
    setIsSynchronizingTrophies(true);
    setErrorMessage(null);

    try {
      const result = await playStationApi.synchronizeProgress();

      setLastProgressSync(result);
      await refreshGames();
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === "playstation_sync_in_progress"
      ) {
        const progress = await refreshSyncProgress().catch(() => null);

        if (progress?.status === "running") {
          return;
        }
      }

      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSynchronizingTrophies(false);
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

    showToast({
      tone: "success",
      message: `${game.title} was added from IGDB.`,
    });
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
    const succeeded = await performMutation(
      game.id,
      `${game.title} was permanently deleted.`,
      () => libraryApi.deletePermanently(game.id),
    );

    if (succeeded) {
      setGamePendingDeletion(null);

      if (editingGame?.id === game.id) {
        setEditingGame(null);
      }
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
            disabled={synchronizationActive}
          >
            Add manually
          </button>

          <button
            className="button button--quiet"
            type="button"
            onClick={openIgdbSearch}
            disabled={synchronizationActive}
          >
            Search IGDB
          </button>

          <button
            className="button button--primary"
            type="button"
            onClick={() => void handleSyncTrophyProgress()}
            disabled={
              loadState === "loading" ||
              busyKey !== null ||
              synchronizationActive
            }
            aria-busy={synchronizationActive}
          >
            {synchronizationActive
              ? "Syncing Trophy Progress…"
              : "Sync Trophy Progress"}
          </button>
        </div>
      </div>

      <PlayStationSyncProgressPanel progress={syncProgress} />

      {lastProgressSync === null && latestStoredTrophyUpdate !== null ? (
        <p className="library-sync-history">
          Last stored trophy update{" "}
          <strong>{formatDateTime(latestStoredTrophyUpdate)}</strong>
        </p>
      ) : null}

      {lastProgressSync === null ? null : (
        <section
          className={`psn-sync-result${
            lastProgressSync.synchronization.status === "partial"
              ? " psn-sync-result--partial"
              : ""
          }`}
          aria-labelledby="library-sync-result-title"
        >
          <div className="psn-sync-result__heading">
            <div>
              <p className="eyebrow">Latest trophy refresh</p>

              <h3 id="library-sync-result-title">
                {lastProgressSync.synchronization.status === "succeeded"
                  ? "Library trophy progress updated"
                  : "Trophy progress updated partially"}
              </h3>
            </div>

            <span
              className={`psn-sync-status psn-sync-status--${
                lastProgressSync.synchronization.status
              }`}
            >
              {lastProgressSync.synchronization.status === "succeeded"
                ? "Succeeded"
                : "Partial"}
            </span>
          </div>

          <div className="psn-sync-result__counts">
            <div>
              <strong>
                {lastProgressSync.synchronization.processedTitleCount}
              </strong>

              <span>
                of {lastProgressSync.synchronization.expectedTitleCount} linked
                games
              </span>
            </div>

            <div>
              <strong>
                {lastProgressSync.synchronization.snapshotsCreated}
              </strong>

              <span>Game snapshots</span>
            </div>

            <div>
              <strong>
                {lastProgressSync.synchronization.newTrophyAlertsCreated +
                  lastProgressSync.synchronization.completionLostAlertsCreated}
              </strong>

              <span>New alerts</span>
            </div>

            <div>
              <strong>
                {lastProgressSync.detailSynchronization.fullRefreshCount +
                  lastProgressSync.detailSynchronization
                    .earningsOnlyRefreshCount}
              </strong>

              <span>Detailed trophy updates</span>
            </div>

            <div>
              <strong>
                Level{" "}
                {lastProgressSync.synchronization.profileSnapshot.trophyLevel}
              </strong>

              <span>PSN trophy level</span>
            </div>

            <div>
              <strong>
                {
                  lastProgressSync.synchronization.profileSnapshot
                    .levelProgressPercent
                }
                %
              </strong>

              <span>To next level</span>
            </div>
          </div>

          {lastProgressSync.synchronization.status === "partial" ? (
            <p className="psn-sync-result__warning">
              Sony’s response did not include every linked trophy stack.
              Existing data for missing stacks was preserved.
            </p>
          ) : null}

          <p className="psn-sync-result__time">
            Selected {lastProgressSync.selection.linkedTitleCount} linked trophy{" "}
            {lastProgressSync.selection.linkedTitleCount === 1
              ? "stack"
              : "stacks"}{" "}
            from {lastProgressSync.selection.supportedTitleCount} supported PSN
            titles. {lastProgressSync.detailSynchronization.unchangedCount}{" "}
            required no detailed requests;{" "}
            {lastProgressSync.detailSynchronization.requestsMade} detailed PSN{" "}
            {lastProgressSync.detailSynchronization.requestsMade === 1
              ? "request"
              : "requests"}
            . Finished{" "}
            {formatDateTime(lastProgressSync.synchronization.finishedAt)}
          </p>
        </section>
      )}

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

      <ConfirmDialog
        open={gamePendingDeletion !== null}
        title="Permanently delete game?"
        description={
          <p>
            Permanently delete{" "}
            <strong>{gamePendingDeletion?.title ?? "this game"}</strong>? Its
            local metadata, resources, trophy history, and alerts will also be
            deleted. Recovery requires a backup.
          </p>
        }
        confirmLabel="Permanently delete"
        busy={busyKey === gamePendingDeletion?.id}
        onCancel={() => setGamePendingDeletion(null)}
        onConfirm={() => {
          if (gamePendingDeletion !== null) {
            void handleDelete(gamePendingDeletion);
          }
        }}
      />

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
                busy={busyKey !== null || isSynchronizingTrophies}
                onMoveUp={() => void moveGame(game.id, -1)}
                onMoveDown={() => void moveGame(game.id, 1)}
                onEdit={() => openEditForm(game)}
                onHide={() => void handleHide(game)}
                onUnhide={() => void handleUnhide(game)}
                onDelete={() => setGamePendingDeletion(game)}
              />
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
