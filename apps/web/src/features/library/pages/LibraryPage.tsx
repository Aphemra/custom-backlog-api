import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { SortableList } from "../../../components/sortable/SortableList";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { Dialog } from "../../../components/ui/Dialog";
import type { CollectionSummary } from "../../../domain/collection";
import { useToast } from "../../../components/toast/useToast";
import { useProfileProgression } from "../../../components/profile/useProfileProgression";
import type {
  CreateLibraryGameInput,
  LibraryGame,
  LibraryGameListItem,
} from "../../../domain/libraryGame";
import type { PlayStationProgressSynchronizationResponse } from "../../../domain/playStation";
import type {
  SavedView,
  SavedViewFilters,
  SavedViewInput,
  SavedViewSort,
} from "../../../domain/savedView";
import { ApiError } from "../../../services/api/apiClient";
import { collectionApi } from "../../../services/api/collectionApi";
import { libraryApi } from "../../../services/api/libraryApi";
import { playStationApi } from "../../../services/api/playStationApi";
import { savedViewApi } from "../../../services/api/savedViewApi";
import { PlayStationSyncProgressPanel } from "../../playstation/components/PlayStationSyncProgressPanel";
import { usePlayStationSyncProgress } from "../../playstation/hooks/usePlayStationSyncProgress";
import { PortableDataPage } from "../../portableData/pages/PortableDataPage";
import { SavedViewForm } from "../../savedViews/components/SavedViewForm";
import { IgdbGameSearch } from "../components/IgdbGameSearch";
import { LibraryFilterPanel } from "../components/LibraryFilterPanel";
import { LibraryGameForm } from "../components/LibraryGameForm";
import { LibraryGameRow } from "../components/LibraryGameRow";
import { LibraryViewActionsMenu } from "../components/LibraryViewActionsMenu";
import { SavedViewManager } from "../components/SavedViewManager";
import { applyLibraryView } from "../libraryViewEvaluator";

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

function isCompleteManualOrderView(view: SavedView): boolean {
  const filters = view.filters;

  return (
    view.builtinKey === "all_games" &&
    view.sort.field === "priorityRank" &&
    view.sort.direction === "asc" &&
    (filters.hiddenMode ?? "visible") === "visible" &&
    (filters.search === undefined || filters.search.trim().length === 0) &&
    filters.platforms === undefined &&
    filters.playStatuses === undefined &&
    filters.collectionIds === undefined &&
    filters.platinumEarned === undefined &&
    filters.is100Percent === undefined &&
    filters.needsSync === undefined &&
    filters.alertKinds === undefined &&
    filters.alertStatus === undefined
  );
}

export function LibraryPage() {
  const { showToast } = useToast();
  const { refreshProfileProgression } = useProfileProgression();

  const [games, setGames] = useState<readonly LibraryGameListItem[]>([]);
  const [views, setViews] = useState<readonly SavedView[]>([]);
  const [collections, setCollections] = useState<readonly CollectionSummary[]>(
    [],
  );
  const [selectedViewId, setSelectedViewId] = useState<string | null>(null);
  const [filterOverrides, setFilterOverrides] =
    useState<SavedViewFilters | null>(null);
  const [sortOverride, setSortOverride] = useState<SavedViewSort | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [viewManagerExpanded, setViewManagerExpanded] = useState(false);
  const [isCreatingView, setIsCreatingView] = useState(false);
  const [editingView, setEditingView] = useState<SavedView | null>(null);
  const [viewPendingDeletion, setViewPendingDeletion] =
    useState<SavedView | null>(null);
  const [viewBusy, setViewBusy] = useState(false);
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  const [portableDataBusy, setPortableDataBusy] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
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

  const handledSyncFinishedAtRef = useRef<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    async function loadLibrary() {
      try {
        const [loadedGames, loadedViews, loadedCollections] = await Promise.all(
          [
            libraryApi.list(abortController.signal),
            savedViewApi.list(abortController.signal),
            collectionApi.list(abortController.signal),
          ],
        );

        if (!abortController.signal.aborted) {
          const defaultView =
            loadedViews.find((view) => view.builtinKey === "all_games") ??
            loadedViews.find((view) => view.isAvailable) ??
            loadedViews[0] ??
            null;

          setGames(loadedGames);
          setViews(loadedViews);
          setCollections(loadedCollections);
          setSelectedViewId(defaultView?.id ?? null);
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

  const selectedView = useMemo(
    () => views.find((view) => view.id === selectedViewId) ?? null,
    [selectedViewId, views],
  );

  const effectiveView = useMemo(
    () =>
      selectedView === null
        ? null
        : {
            ...selectedView,
            filters: filterOverrides ?? selectedView.filters,
            sort: sortOverride ?? selectedView.sort,
          },
    [filterOverrides, selectedView, sortOverride],
  );

  const viewGames = useMemo(
    () =>
      effectiveView === null || !effectiveView.isAvailable
        ? []
        : applyLibraryView(games, effectiveView, searchQuery),
    [effectiveView, games, searchQuery],
  );

  const viewAdjusted = filterOverrides !== null || sortOverride !== null;

  const refreshGames = useCallback(async (): Promise<void> => {
    setGames(await libraryApi.list());
  }, []);

  async function refreshViews(preferredViewId?: string): Promise<void> {
    const loadedViews = await savedViewApi.list();

    const nextView =
      loadedViews.find((view) => view.id === preferredViewId) ??
      loadedViews.find((view) => view.id === selectedViewId) ??
      loadedViews.find((view) => view.builtinKey === "all_games") ??
      loadedViews.find((view) => view.isAvailable) ??
      loadedViews[0] ??
      null;

    setViews(loadedViews);
    setSelectedViewId(nextView?.id ?? null);
    setFilterOverrides(null);
    setSortOverride(null);
    setSearchQuery("");
  }

  async function handlePortableDataImported(): Promise<void> {
    const [loadedCollections] = await Promise.all([
      collectionApi.list(),
      refreshGames(),
      refreshViews(),
      refreshProfileProgression(),
    ]);

    setCollections(loadedCollections);
    setFiltersExpanded(false);
    setViewManagerExpanded(false);

    showToast({
      tone: "success",
      message: "The imported backlog is loaded and ready.",
    });
  }

  async function handleCreateView(input: SavedViewInput): Promise<void> {
    setViewBusy(true);
    setErrorMessage(null);

    try {
      const created = await savedViewApi.create(input);

      await refreshViews(created.id);
      setIsCreatingView(false);

      showToast({
        tone: "success",
        message: `${created.name} was created and selected.`,
      });
    } catch (error) {
      const message = getErrorMessage(error);

      setErrorMessage(message);

      showToast({
        tone: "error",
        message,
      });
    } finally {
      setViewBusy(false);
    }
  }

  async function handleUpdateView(input: SavedViewInput): Promise<void> {
    if (editingView === null) {
      return;
    }

    setViewBusy(true);
    setErrorMessage(null);

    try {
      const updated = await savedViewApi.update(editingView.id, input);

      await refreshViews(updated.id);
      setEditingView(null);

      showToast({
        tone: "success",
        message: `${updated.name} was updated.`,
      });
    } catch (error) {
      const message = getErrorMessage(error);

      setErrorMessage(message);

      showToast({
        tone: "error",
        message,
      });
    } finally {
      setViewBusy(false);
    }
  }

  async function handleDeleteView(view: SavedView): Promise<void> {
    setViewBusy(true);
    setErrorMessage(null);

    try {
      await savedViewApi.delete(view.id);
      await refreshViews();

      setEditingView(null);
      setViewPendingDeletion(null);

      showToast({
        tone: "success",
        message: `${view.name} was deleted. No games were changed.`,
      });
    } catch (error) {
      const message = getErrorMessage(error);

      setErrorMessage(message);

      showToast({
        tone: "error",
        message,
      });
    } finally {
      setViewBusy(false);
    }
  }

  async function handleReorderViews(
    orderedViews: readonly SavedView[],
  ): Promise<void> {
    const previousViews = views;

    setViews(orderedViews);
    setViewBusy(true);
    setErrorMessage(null);

    try {
      const savedViews = await savedViewApi.reorder(
        orderedViews.map((view) => view.id),
      );

      setViews(savedViews);

      showToast({
        tone: "success",
        message: "Saved View order was updated.",
      });
    } catch (error) {
      const message = getErrorMessage(error);

      setViews(previousViews);
      setErrorMessage(message);

      showToast({
        tone: "error",
        message,
      });
    } finally {
      setViewBusy(false);
    }
  }

  function selectLibraryView(viewId: string) {
    setSelectedViewId(viewId);
    setFilterOverrides(null);
    setSortOverride(null);
    setSearchQuery("");
  }

  useEffect(() => {
    const finishedAt = syncProgress?.finishedAt;

    if (
      syncProgress?.status !== "succeeded" ||
      finishedAt === null ||
      finishedAt === undefined ||
      handledSyncFinishedAtRef.current === finishedAt
    ) {
      return;
    }

    handledSyncFinishedAtRef.current = finishedAt;

    void refreshGames().catch((error: unknown) => {
      setErrorMessage(getErrorMessage(error));
    });
  }, [refreshGames, syncProgress?.finishedAt, syncProgress?.status]);

  const orderedVisibleGames = useMemo(
    () => games.filter((game) => game.hiddenAt === null),
    [games],
  );

  const hiddenGames = useMemo(
    () => games.filter((game) => game.hiddenAt !== null),
    [games],
  );

  const manualOrderViewSelected =
    effectiveView !== null && isCompleteManualOrderView(effectiveView);

  const orderingDisabled =
    !manualOrderViewSelected || searchQuery.trim().length > 0;

  const backlogSectionsEnabled = !orderingDisabled;

  const activeBacklogGames = useMemo(
    () =>
      backlogSectionsEnabled
        ? viewGames.filter((game) => game.playStatus !== "completed")
        : [],
    [backlogSectionsEnabled, viewGames],
  );

  const completedBacklogGames = useMemo(
    () =>
      backlogSectionsEnabled
        ? viewGames.filter((game) => game.playStatus === "completed")
        : [],
    [backlogSectionsEnabled, viewGames],
  );

  const completedOrderNeedsNormalization = useMemo(() => {
    let completedGameEncountered = false;

    for (const game of orderedVisibleGames) {
      if (game.playStatus === "completed") {
        completedGameEncountered = true;
      } else if (completedGameEncountered) {
        return true;
      }
    }

    return false;
  }, [orderedVisibleGames]);

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

      await Promise.all([refreshGames(), refreshProfileProgression()]);
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

  async function saveGameOrder(
    orderedGames: readonly LibraryGameListItem[],
    successMessage: string,
  ): Promise<void> {
    const previousGames = games;

    const previousHiddenGames = games.filter((game) => game.hiddenAt !== null);

    const optimisticVisibleGames = orderedGames.map((game, index) => ({
      ...game,
      priorityRank: (index + 1) * 1_000,
    }));

    setGames([...optimisticVisibleGames, ...previousHiddenGames]);
    setBusyKey("order");
    setErrorMessage(null);

    try {
      const savedVisibleGames = await libraryApi.reorder(
        orderedGames.map((game) => game.id),
      );

      setGames([...savedVisibleGames, ...previousHiddenGames]);

      showToast({
        tone: "success",
        message: successMessage,
      });
    } catch (error) {
      setGames(previousGames);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyKey(null);
    }
  }

  async function reorderBacklogGames(
    orderedBacklogGames: readonly LibraryGameListItem[],
  ): Promise<void> {
    if (!backlogSectionsEnabled) {
      return;
    }

    await saveGameOrder(
      [...orderedBacklogGames, ...completedBacklogGames],
      "Backlog order was updated.",
    );
  }

  async function sendCompletedGamesToBottom(): Promise<void> {
    if (!completedOrderNeedsNormalization) {
      return;
    }

    const activeGames = orderedVisibleGames.filter(
      (game) => game.playStatus !== "completed",
    );

    const completedGames = orderedVisibleGames.filter(
      (game) => game.playStatus === "completed",
    );

    await saveGameOrder(
      [...activeGames, ...completedGames],
      "Completed games were moved to the bottom of the backlog.",
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

  function renderLibraryGameRow(
    game: LibraryGameListItem,
    dragHandle: ReactNode | null,
    position: number | null,
  ) {
    return (
      <LibraryGameRow
        game={game}
        position={position}
        dragHandle={dragHandle}
        busy={busyKey !== null || isSynchronizingTrophies}
        onEdit={() => openEditForm(game)}
        onHide={() => void handleHide(game)}
        onUnhide={() => void handleUnhide(game)}
        onDelete={() => setGamePendingDeletion(game)}
      />
    );
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
        <label className="library-view-picker">
          <span>Library view</span>

          <select
            value={selectedViewId ?? ""}
            disabled={loadState !== "ready" || views.length === 0}
            onChange={(event) => selectLibraryView(event.target.value)}
          >
            {views.map((view) => (
              <option
                key={view.id}
                value={view.id}
                disabled={!view.isAvailable}
              >
                {view.name}
                {view.isBuiltin ? "" : " — Custom"}
              </option>
            ))}
          </select>
        </label>

        <label className="search-field">
          <span className="visually-hidden">
            Search within the selected Library view
          </span>

          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search within this view…"
          />
        </label>

        <LibraryViewActionsMenu
          viewAvailable={effectiveView !== null}
          viewsAvailable={views.length > 0}
          filtersExpanded={filtersExpanded}
          viewManagerExpanded={viewManagerExpanded}
          viewAdjusted={viewAdjusted}
          mutationsBusy={
            viewBusy || busyKey !== null || isSynchronizingTrophies
          }
          showCompletedAction={
            backlogSectionsEnabled && completedBacklogGames.length > 0
          }
          completedOrderNeedsNormalization={completedOrderNeedsNormalization}
          onToggleFilters={() => setFiltersExpanded((expanded) => !expanded)}
          onResetFilters={() => {
            setFilterOverrides(null);
            setSortOverride(null);
          }}
          onCreateView={() => setIsCreatingView(true)}
          onToggleViewManager={() =>
            setViewManagerExpanded((expanded) => !expanded)
          }
          onSendCompletedToBottom={() => {
            void sendCompletedGamesToBottom();
          }}
        />

        <button
          className="button button--quiet library-controls__backup"
          type="button"
          disabled={synchronizationActive || busyKey !== null || viewBusy}
          onClick={() => setBackupDialogOpen(true)}
        >
          Backup / Restore
        </button>
      </div>

      {filtersExpanded && effectiveView !== null ? (
        <LibraryFilterPanel
          filters={effectiveView.filters}
          sort={effectiveView.sort}
          collections={collections}
          adjusted={viewAdjusted}
          onFiltersChange={setFilterOverrides}
          onSortChange={setSortOverride}
          onReset={() => {
            setFilterOverrides(null);
            setSortOverride(null);
          }}
        />
      ) : null}

      {viewManagerExpanded ? (
        <SavedViewManager
          views={views}
          selectedViewId={selectedViewId}
          busy={viewBusy}
          onSelect={selectLibraryView}
          onEdit={setEditingView}
          onDelete={setViewPendingDeletion}
          onReorder={(orderedViews) => {
            void handleReorderViews(orderedViews);
          }}
        />
      ) : null}

      {selectedView === null ? null : (
        <div className="library-view-summary">
          <span>
            Showing <strong>{selectedView.name}</strong>
            {viewAdjusted ? " with temporary refinements" : ""}
          </span>

          <span>
            {viewGames.length} {viewGames.length === 1 ? "game" : "games"}
          </span>
        </div>
      )}

      {orderingDisabled ? (
        <p className="helper-message">
          {manualOrderViewSelected
            ? "Clear the search to change the full Library order."
            : "Manual reordering is available only in the complete, unfiltered All games view."}
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

      <Dialog
        open={backupDialogOpen}
        title="Backup / Restore"
        description="Download a portable copy of your local backlog or safely replace it from an earlier export."
        size="large"
        dismissible={!portableDataBusy}
        onClose={() => setBackupDialogOpen(false)}
      >
        <PortableDataPage
          onImported={handlePortableDataImported}
          onImportingChange={setPortableDataBusy}
        />
      </Dialog>

      <Dialog
        open={isCreatingView}
        title="Create Saved View"
        description="The current filters and sorting are used as the starting definition. Live search remains temporary."
        size="large"
        dismissible={!viewBusy}
        onClose={() => setIsCreatingView(false)}
      >
        <SavedViewForm
          initialFilters={effectiveView?.filters}
          initialSort={effectiveView?.sort}
          showHeading={false}
          collections={collections}
          onSubmit={handleCreateView}
          onCancel={() => setIsCreatingView(false)}
        />
      </Dialog>

      <Dialog
        open={editingView !== null}
        title={`Edit ${editingView?.name ?? "Saved View"}`}
        description="Update the reusable filters and sorting for this view."
        size="large"
        dismissible={!viewBusy}
        onClose={() => setEditingView(null)}
      >
        {editingView === null ? null : (
          <SavedViewForm
            key={editingView.id}
            initialView={editingView}
            showHeading={false}
            collections={collections}
            onSubmit={handleUpdateView}
            onCancel={() => setEditingView(null)}
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={viewPendingDeletion !== null}
        title="Delete Saved View?"
        description={
          <p>
            Delete{" "}
            <strong>{viewPendingDeletion?.name ?? "this Saved View"}</strong>?
            The view definition will be removed, but no games, Collections, or
            trophy data will be changed.
          </p>
        }
        confirmLabel="Delete Saved View"
        busy={viewBusy}
        onCancel={() => setViewPendingDeletion(null)}
        onConfirm={() => {
          if (viewPendingDeletion !== null) {
            void handleDeleteView(viewPendingDeletion);
          }
        }}
      />

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

      {loadState === "ready" && viewGames.length === 0 ? (
        <div className="empty-state">
          <h3>
            {games.length === 0
              ? "Your library is ready."
              : "No games match this view."}
          </h3>
          <p>
            {games.length === 0
              ? "Search IGDB for automatic metadata, or create a manual entry."
              : "Try another Library view or clear the current search."}
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

      {loadState === "ready" && viewGames.length > 0 ? (
        backlogSectionsEnabled ? (
          <div className="backlog-sections">
            <section
              className="backlog-section"
              aria-labelledby="active-backlog-title"
            >
              <div className="backlog-section__heading">
                <div>
                  <h3 id="active-backlog-title">Backlog</h3>

                  <p>Drag games into the order you plan to pursue them.</p>
                </div>

                <span>
                  {activeBacklogGames.length}{" "}
                  {activeBacklogGames.length === 1 ? "game" : "games"}
                </span>
              </div>

              {activeBacklogGames.length === 0 ? (
                <div className="backlog-section__empty">
                  Every visible game is currently marked Completed.
                </div>
              ) : (
                <div className="game-list">
                  <SortableList
                    items={activeBacklogGames}
                    disabled={busyKey !== null || isSynchronizingTrophies}
                    ariaLabel="Active backlog order"
                    getItemLabel={(game) => game.title}
                    onReorder={(orderedGames) => {
                      void reorderBacklogGames(orderedGames);
                    }}
                    renderItem={(game, controls) =>
                      renderLibraryGameRow(
                        game,
                        controls.dragHandle,
                        controls.position,
                      )
                    }
                  />
                </div>
              )}
            </section>

            {completedBacklogGames.length === 0 ? null : (
              <details className="completed-backlog">
                <summary>
                  <span>
                    <strong>Completed</strong>

                    <small>
                      Finished games are kept outside the active backlog order.
                    </small>
                  </span>

                  <span className="completed-backlog__count">
                    {completedBacklogGames.length}
                  </span>
                </summary>

                <div className="game-list completed-backlog__games">
                  {completedBacklogGames.map((game, index) => (
                    <div key={game.id}>
                      {renderLibraryGameRow(
                        game,
                        null,
                        activeBacklogGames.length + index + 1,
                      )}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        ) : (
          <div className="game-list">
            <SortableList
              items={viewGames}
              disabled
              ariaLabel={`${selectedView?.name ?? "Library"} games`}
              getItemLabel={(game) => game.title}
              onReorder={() => undefined}
              renderItem={(game, controls) => {
                const activeIndex = orderedVisibleGames.findIndex(
                  (candidate) => candidate.id === game.id,
                );
                const isHidden = game.hiddenAt !== null;

                return renderLibraryGameRow(
                  game,
                  isHidden ? null : controls.dragHandle,
                  isHidden ? null : activeIndex + 1,
                );
              }}
            />
          </div>
        )
      ) : null}
    </section>
  );
}
