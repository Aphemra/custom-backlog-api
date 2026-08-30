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
import { Dropdown } from "../../../components/ui/Dropdown";
import { IconButton } from "../../../components/ui/IconButton";
import { PlusIcon, SyncIcon, TuneIcon } from "../../../components/ui/icons";
import type { CollectionSummary } from "../../../domain/collection";
import { useToast } from "../../../components/toast/useToast";
import { useProfileProgression } from "../../../components/profile/useProfileProgression";
import type {
  LibraryGame,
  LibraryGameListItem,
  UpdateLibraryGameInput,
} from "../../../domain/libraryGame";
import type {
  PlayStationProgressSynchronizationResponse,
  PlayStationTrophyCounts,
} from "../../../domain/playStation";
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
import { getPlayStationCredentialGuidance } from "../../playstation/playStationCredentialError";
import { requestSettingsNavigation } from "../../settings/settingsNavigation";
import { usePlayStationSyncProgress } from "../../playstation/hooks/usePlayStationSyncProgress";
import { SavedViewForm } from "../../savedViews/components/SavedViewForm";
import { GameDetailsDialog } from "../components/GameDetailsDialog";
import { IgdbGameSearch } from "../components/IgdbGameSearch";
import { LibraryFilterPanel } from "../components/LibraryFilterPanel";
import { LibraryGameForm } from "../components/LibraryGameForm";
import { LibraryGameRow } from "../components/LibraryGameRow";
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

function countTrophies(counts: PlayStationTrophyCounts): number {
  return counts.bronze + counts.silver + counts.gold + counts.platinum;
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

interface LibraryPageProps {
  readonly onAlertsChanged: () => void | Promise<void>;
}

export function LibraryPage({ onAlertsChanged }: LibraryPageProps) {
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
  const [viewToolsOpen, setViewToolsOpen] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [backlogExpanded, setBacklogExpanded] = useState(true);
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [editingView, setEditingView] = useState<SavedView | null>(null);
  const [viewPendingDeletion, setViewPendingDeletion] =
    useState<SavedView | null>(null);
  const [viewBusy, setViewBusy] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchingIgdb, setIsSearchingIgdb] = useState(false);
  const [detailsGame, setDetailsGame] = useState<LibraryGameListItem | null>(
    null,
  );
  const [editingGame, setEditingGame] = useState<LibraryGameListItem | null>(
    null,
  );
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

  const pinnedCollection =
    collections.find((collection) => collection.isPinned) ?? null;

  const pinnedTrophySummary = pinnedCollection?.trophySummary ?? null;

  const pinnedEarnedTrophies =
    pinnedTrophySummary === null
      ? 0
      : countTrophies(pinnedTrophySummary.earnedTrophies);

  const pinnedTotalTrophies =
    pinnedTrophySummary === null
      ? 0
      : countTrophies(pinnedTrophySummary.totalTrophies);

  const pinnedAttainableTrophies =
    pinnedTrophySummary === null
      ? 0
      : countTrophies(pinnedTrophySummary.availability.attainableTrophies);

  const pinnedUnobtainableTrophies =
    pinnedTrophySummary === null
      ? 0
      : countTrophies(pinnedTrophySummary.availability.unobtainableTrophies);

  const pinnedHasUnobtainableTrophies = pinnedUnobtainableTrophies > 0;

  const pinnedProgressPercent =
    pinnedTrophySummary?.availability.attainableProgressPercent ?? 0;

  const pinnedEarnedProgressShare =
    pinnedTrophySummary?.availability.earnedProgressSharePercent ?? 0;

  const pinnedUnobtainableProgressShare =
    pinnedTrophySummary?.availability.unobtainableProgressSharePercent ?? 0;

  const pinnedAttainablePointsRemaining =
    pinnedTrophySummary === null
      ? 0
      : Math.max(
          0,
          pinnedTrophySummary.availability.attainablePoints -
            pinnedTrophySummary.points.earned,
        );

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

  async function handleCreateView(input: SavedViewInput): Promise<boolean> {
    setViewBusy(true);
    setErrorMessage(null);

    try {
      const created = await savedViewApi.create(input);

      await refreshViews(created.id);

      showToast({
        tone: "success",
        message: `${created.name} was created and selected.`,
      });

      return true;
    } catch (error) {
      const message = getErrorMessage(error);

      setErrorMessage(message);

      showToast({
        tone: "error",
        message,
      });

      return false;
    } finally {
      setViewBusy(false);
    }
  }

  async function handleCreateViewFromCurrentSettings(): Promise<void> {
    if (effectiveView === null || newViewName.trim().length === 0) {
      return;
    }

    const created = await handleCreateView({
      name: newViewName.trim(),
      filters: effectiveView.filters,
      sort: effectiveView.sort,
    });

    if (created) {
      setNewViewName("");
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

    void Promise.all([refreshGames(), onAlertsChanged()]).catch(
      (error: unknown) => {
        setErrorMessage(getErrorMessage(error));
      },
    );
  }, [
    onAlertsChanged,
    refreshGames,
    syncProgress?.finishedAt,
    syncProgress?.status,
  ]);

  const orderedVisibleGames = useMemo(
    () => games.filter((game) => game.hiddenAt === null),
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

      await Promise.all([
        refreshGames(),
        refreshProfileProgression(),
        onAlertsChanged(),
      ]);
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

      const credentialGuidance = getPlayStationCredentialGuidance(error);

      if (credentialGuidance !== null) {
        showToast({
          tone: "error",
          title: "PSN credentials need attention",
          message: credentialGuidance,
          durationSeconds: 15,
          action: {
            label: "Open Settings",
            onSelect: requestSettingsNavigation,
          },
        });
      }

      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSynchronizingTrophies(false);
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

  async function handleUpdate(
    input: UpdateLibraryGameInput,
    collectionIds: readonly string[],
  ): Promise<void> {
    if (editingGame === null) {
      return;
    }

    const succeeded = await performMutation(
      editingGame.id,
      `${input.title} was updated.`,
      async () => {
        await libraryApi.update(editingGame.id, input);

        await collectionApi.replaceGameMemberships(
          editingGame.id,
          collectionIds,
        );

        setCollections(await collectionApi.list());
      },
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

  function openIgdbSearch() {
    setEditingGame(null);
    setIsSearchingIgdb(true);
    setErrorMessage(null);
  }

  function openEditForm(game: LibraryGameListItem) {
    setIsSearchingIgdb(false);
    setEditingGame(game);
    setErrorMessage(null);
  }

  function closeForm() {
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
        onOpenDetails={() => setDetailsGame(game)}
        onEdit={() => openEditForm(game)}
        onHide={() => void handleHide(game)}
        onUnhide={() => void handleUnhide(game)}
        onDelete={() => setGamePendingDeletion(game)}
      />
    );
  }

  return (
    <section className="library-page" aria-labelledby="library-title">
      <h2 id="library-title" className="visually-hidden">
        Library
      </h2>

      <div className="library-toolbar">
        <div className="library-controls">
          <Dropdown
            className="library-view-picker"
            label={selectedView?.name ?? "Choose view"}
            accessibleLabel="Library view"
            mode="listbox"
            disabled={loadState !== "ready" || views.length === 0}
            items={views.map((view) => ({
              id: view.id,
              label: `${view.name}${view.isBuiltin ? "" : " — Custom"}`,
              selected: view.id === selectedViewId,
              disabled: !view.isAvailable,
              onSelect: () => selectLibraryView(view.id),
            }))}
          />

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

          <div className="library-toolbar__icon-actions">
            <IconButton
              className={`library-toolbar__action-button library-toolbar__view-tools-button${
                viewAdjusted
                  ? " library-toolbar__view-tools-button--adjusted"
                  : ""
              }`}
              label="Library view tools"
              icon={<TuneIcon />}
              tooltipPlacement="bottom"
              tooltipAlignment="end"
              onClick={() => setViewToolsOpen(true)}
              disabled={loadState !== "ready" || effectiveView === null}
            />
            <IconButton
              className="library-toolbar__action-button"
              label="Add game"
              icon={<PlusIcon />}
              tooltipPlacement="bottom"
              tooltipAlignment="end"
              onClick={openIgdbSearch}
              disabled={synchronizationActive}
            />

            <IconButton
              className={`library-toolbar__action-button library-toolbar__sync-button${
                synchronizationActive
                  ? " library-toolbar__sync-button--active"
                  : ""
              }`}
              label={
                synchronizationActive ? "Syncing trophies" : "Sync trophies"
              }
              icon={<SyncIcon />}
              tooltipPlacement="bottom"
              tooltipAlignment="end"
              onClick={() => void handleSyncTrophyProgress()}
              disabled={
                loadState === "loading" ||
                busyKey !== null ||
                synchronizationActive
              }
              aria-busy={synchronizationActive}
            />
          </div>
        </div>

        <div className="library-toolbar__footer">
          <div className="library-toolbar__context">
            {selectedView === null ? null : (
              <span>
                Showing {viewGames.length} of {games.length} games
                {viewAdjusted ? " · Filters applied" : ""}
              </span>
            )}

            {orderingDisabled ? (
              <span>
                {manualOrderViewSelected
                  ? "Clear search to enable manual reordering"
                  : 'Manual reordering requires the "All games" view'}
              </span>
            ) : null}

            {latestStoredTrophyUpdate === null ? null : (
              <span className="library-toolbar__last-sync">
                Last synced:
                <strong>{` ${formatDateTime(latestStoredTrophyUpdate)}`}</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {pinnedCollection === null ? null : (
        <section
          className="pinned-collection-summary"
          aria-labelledby="pinned-collection-title"
        >
          <div className="pinned-collection-summary__identity">
            <span>Pinned Collection</span>

            <h3 id="pinned-collection-title">{pinnedCollection.name}</h3>
          </div>

          <div className="pinned-collection-summary__progress">
            <div className="pinned-collection-summary__progress-heading">
              <strong>{pinnedProgressPercent}%</strong>

              <span>
                {pinnedTrophySummary?.completedGameCount ?? 0} of{" "}
                {pinnedCollection.gameCount} games at 100%
                {pinnedHasUnobtainableTrophies
                  ? ` · ${pinnedUnobtainableTrophies.toLocaleString()} unobtainable`
                  : ""}
              </span>
            </div>

            <div
              className="pinned-collection-summary__track"
              role="progressbar"
              aria-label={`${pinnedCollection.name} attainable trophy progress`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pinnedProgressPercent}
            >
              <span
                className="pinned-collection-summary__progress-earned"
                style={{ width: `${pinnedEarnedProgressShare}%` }}
              />

              {pinnedHasUnobtainableTrophies ? (
                <span
                  className="pinned-collection-summary__progress-unobtainable"
                  style={{
                    width: `${pinnedUnobtainableProgressShare}%`,
                  }}
                />
              ) : null}
            </div>
          </div>

          <div className="pinned-collection-summary__totals">
            {pinnedTrophySummary === null ? (
              <span>No trophy data yet</span>
            ) : (
              <>
                <strong>
                  {pinnedEarnedTrophies.toLocaleString()} /{" "}
                  {pinnedAttainableTrophies.toLocaleString()}
                  {pinnedHasUnobtainableTrophies
                    ? ` (${pinnedTotalTrophies.toLocaleString()})`
                    : ""}
                </strong>

                <span>Trophies earned</span>

                <strong>
                  {pinnedAttainablePointsRemaining.toLocaleString()}
                </strong>

                <span>
                  {pinnedHasUnobtainableTrophies
                    ? "Attainable points remaining"
                    : "Points remaining"}
                </span>
              </>
            )}
          </div>
        </section>
      )}

      <PlayStationSyncProgressPanel progress={syncProgress} />

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

      {errorMessage === null ? null : (
        <div className="notice notice--error" role="alert">
          {errorMessage}
        </div>
      )}

      <Dialog
        open={viewToolsOpen}
        title="Library View Tools"
        description="Filter and order the current Library view, save reusable views, and manage existing view definitions."
        size="xlarge"
        dismissible={!viewBusy}
        onClose={() => setViewToolsOpen(false)}
      >
        {effectiveView === null ? (
          <div className="empty-state">
            <h3>No Library view is available.</h3>
          </div>
        ) : (
          <div className="library-view-tools-dialog">
            <LibraryFilterPanel
              filters={effectiveView.filters}
              sort={effectiveView.sort}
              collections={collections}
              adjusted={viewAdjusted}
              busy={viewBusy}
              newViewName={newViewName}
              showCompletedAction={
                backlogSectionsEnabled && completedBacklogGames.length > 0
              }
              completedOrderNeedsNormalization={
                completedOrderNeedsNormalization
              }
              onFiltersChange={setFilterOverrides}
              onSortChange={setSortOverride}
              onReset={() => {
                setFilterOverrides(null);
                setSortOverride(null);
              }}
              onNewViewNameChange={setNewViewName}
              onCreateView={() => {
                void handleCreateViewFromCurrentSettings();
              }}
              onMoveCompletedToBottom={() => {
                void sendCompletedGamesToBottom();
              }}
            />

            <details className="library-view-manager-disclosure">
              <summary>
                <span className="library-view-manager-disclosure__title">
                  <strong>Manage saved views</strong>

                  <small>
                    Select, reorder, edit, or delete view definitions.
                  </small>
                </span>

                <span className="library-view-manager-disclosure__count">
                  {views.length} {views.length === 1 ? "view" : "views"}
                </span>
              </summary>

              <div className="library-view-manager-disclosure__body">
                <SavedViewManager
                  views={views}
                  selectedViewId={selectedViewId}
                  busy={viewBusy}
                  embedded
                  onSelect={selectLibraryView}
                  onEdit={setEditingView}
                  onDelete={setViewPendingDeletion}
                  onReorder={(orderedViews) => {
                    void handleReorderViews(orderedViews);
                  }}
                />
              </div>
            </details>
          </div>
        )}
      </Dialog>

      <Dialog
        open={editingGame !== null}
        title={`Edit ${editingGame?.title ?? "game"}`}
        description="Update its Library status, platform, trophy availability, useful links, and personal notes."
        size="large"
        dismissible={editingGame === null || busyKey !== editingGame.id}
        onClose={closeForm}
      >
        {editingGame === null ? null : (
          <LibraryGameForm
            key={editingGame.id}
            initialGame={editingGame}
            collections={collections}
            initialCollectionIds={editingGame.viewData.collectionIds}
            onSubmit={handleUpdate}
            onCancel={closeForm}
            onAvailabilityChanged={refreshGames}
          />
        )}
      </Dialog>

      <GameDetailsDialog
        game={detailsGame}
        onClose={() => setDetailsGame(null)}
        onRefreshed={refreshGames}
      />

      <Dialog
        open={isSearchingIgdb}
        title="Find a PlayStation game"
        description="Search PS3, PS4, and PS5 releases from IGDB. Select a result to inspect its metadata before adding it."
        size="xlarge"
        onClose={() => setIsSearchingIgdb(false)}
      >
        <IgdbGameSearch onAdded={handleIgdbAdded} />
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
              ? "Search IGDB to add your first PlayStation game."
              : "Try another Library view or clear the current search."}
          </p>
          {games.length === 0 ? (
            <button
              className="button button--primary"
              type="button"
              onClick={openIgdbSearch}
            >
              Add your first game
            </button>
          ) : null}
        </div>
      ) : null}

      {loadState === "ready" && viewGames.length > 0 ? (
        backlogSectionsEnabled ? (
          <div className="backlog-sections">
            <details
              className="backlog-disclosure"
              open={backlogExpanded}
              onToggle={(event) => setBacklogExpanded(event.currentTarget.open)}
            >
              <summary>
                <span className="backlog-disclosure__title">
                  <strong>Backlog</strong>

                  <small>
                    Drag games into the order you plan to pursue them.
                  </small>
                </span>

                <span className="backlog-disclosure__count">
                  {activeBacklogGames.length}{" "}
                  {activeBacklogGames.length === 1 ? "game" : "games"}
                </span>
              </summary>

              <div className="backlog-disclosure__body">
                {activeBacklogGames.length === 0 ? (
                  <div className="backlog-disclosure__empty">
                    Every visible game is currently marked Completed.
                  </div>
                ) : (
                  <div className="game-list backlog-disclosure__games">
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
              </div>
            </details>

            {completedBacklogGames.length === 0 ? null : (
              <details
                className="backlog-disclosure"
                open={completedExpanded}
                onToggle={(event) =>
                  setCompletedExpanded(event.currentTarget.open)
                }
              >
                <summary>
                  <span className="backlog-disclosure__title">
                    <strong>Completed</strong>

                    <small>
                      Completed games are kept outside the active backlog order.
                    </small>
                  </span>

                  <span className="backlog-disclosure__count">
                    {completedBacklogGames.length}{" "}
                    {completedBacklogGames.length === 1 ? "game" : "games"}
                  </span>
                </summary>

                <div className="game-list backlog-disclosure__games">
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
