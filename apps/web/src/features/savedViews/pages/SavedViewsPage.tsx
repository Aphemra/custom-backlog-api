import { useEffect, useMemo, useState } from "react";
import type { CollectionSummary } from "../../../domain/collection";
import {
  playStatusLabels,
  type LibraryGameWithTrophySummary,
} from "../../../domain/libraryGame";
import {
  hiddenModeLabels,
  savedViewSortLabels,
  type SavedView,
  type SavedViewInput,
} from "../../../domain/savedView";
import { ApiError } from "../../../services/api/apiClient";
import { collectionApi } from "../../../services/api/collectionApi";
import { savedViewApi } from "../../../services/api/savedViewApi";
import { SavedViewForm } from "../components/SavedViewForm";

type LoadState = "loading" | "ready" | "error";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "Something unexpected went wrong while updating saved views.";
}

function totalTrophies(counts: {
  readonly bronze: number;
  readonly silver: number;
  readonly gold: number;
  readonly platinum: number;
}): number {
  return counts.bronze + counts.silver + counts.gold + counts.platinum;
}

function describeView(
  view: SavedView,
  collections: readonly CollectionSummary[],
): string {
  const parts: string[] = [];
  const filters = view.filters;

  if (filters.platforms !== undefined) {
    parts.push(filters.platforms.join(", "));
  }

  if (filters.playStatuses !== undefined) {
    parts.push(
      filters.playStatuses.map((status) => playStatusLabels[status]).join(", "),
    );
  }

  if (filters.collectionIds !== undefined) {
    const names = filters.collectionIds
      .map((id) => collections.find((collection) => collection.id === id)?.name)
      .filter((name): name is string => name !== undefined);

    if (names.length > 0) {
      parts.push(names.join(" or "));
    }
  }

  if (filters.search !== undefined) {
    parts.push(`“${filters.search}”`);
  }

  if (filters.platinumEarned !== undefined) {
    parts.push(
      filters.platinumEarned ? "Platinum earned" : "Platinum not earned",
    );
  }

  if (filters.is100Percent !== undefined) {
    parts.push(filters.is100Percent ? "100% complete" : "Incomplete");
  }

  if (filters.needsSync !== undefined) {
    parts.push(filters.needsSync ? "Needs first sync" : "No first sync needed");
  }

  if (filters.alertKinds?.includes("completion_lost") === true) {
    parts.push("Completion lost");
  }

  if (filters.alertKinds?.includes("new_trophies") === true) {
    parts.push("New trophies detected");
  }

  if (filters.alertStatus !== undefined) {
    parts.push(`${filters.alertStatus} alerts`);
  }

  parts.push(hiddenModeLabels[filters.hiddenMode ?? "visible"]);

  return parts.join(" · ");
}

export function SavedViewsPage() {
  const [views, setViews] = useState<readonly SavedView[]>([]);

  const [collections, setCollections] = useState<readonly CollectionSummary[]>(
    [],
  );

  const [games, setGames] = useState<readonly LibraryGameWithTrophySummary[]>(
    [],
  );

  const [selectedViewId, setSelectedViewId] = useState<string | null>(null);

  const [editingView, setEditingView] = useState<SavedView | null>(null);

  const [isAdding, setIsAdding] = useState(false);

  const [liveSearch, setLiveSearch] = useState("");

  const [loadState, setLoadState] = useState<LoadState>("loading");

  const [resultsLoading, setResultsLoading] = useState(false);

  const [busy, setBusy] = useState(false);

  const [notice, setNotice] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedView = useMemo(
    () => views.find((view) => view.id === selectedViewId) ?? null,

    [selectedViewId, views],
  );

  const summary = useMemo(
    () => ({
      custom: views.filter((view) => !view.isBuiltin).length,

      available: views.filter((view) => view.isAvailable).length,

      builtin: views.filter((view) => view.isBuiltin).length,
    }),

    [views],
  );

  useEffect(() => {
    const abortController = new AbortController();

    async function loadPage() {
      try {
        const [loadedViews, loadedCollections] = await Promise.all([
          savedViewApi.list(abortController.signal),

          collectionApi.list(abortController.signal),
        ]);

        if (abortController.signal.aborted) {
          return;
        }

        setViews(loadedViews);

        setCollections(loadedCollections);

        setSelectedViewId(
          loadedViews.find((view) => view.isAvailable)?.id ??
            loadedViews[0]?.id ??
            null,
        );

        setLoadState("ready");
      } catch (error) {
        if (!abortController.signal.aborted) {
          setErrorMessage(getErrorMessage(error));

          setLoadState("error");
        }
      }
    }

    void loadPage();

    return () => abortController.abort();
  }, []);

  useEffect(() => {
    if (selectedView === null) {
      return;
    }

    const abortController = new AbortController();

    const timeout = window.setTimeout(() => {
      setResultsLoading(true);

      void savedViewApi
        .listGames(selectedView.id, liveSearch, abortController.signal)
        .then((result) => {
          if (!abortController.signal.aborted) {
            setGames(result.games);
          }
        })
        .catch((error: unknown) => {
          if (!abortController.signal.aborted) {
            setErrorMessage(getErrorMessage(error));
          }
        })
        .finally(() => {
          if (!abortController.signal.aborted) {
            setResultsLoading(false);
          }
        });
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      abortController.abort();
    };
  }, [liveSearch, selectedView]);

  async function refreshViews(preferredId?: string): Promise<void> {
    const loadedViews = await savedViewApi.list();

    setViews(loadedViews);

    const nextId =
      loadedViews.find((view) => view.id === preferredId)?.id ??
      loadedViews.find((view) => view.id === selectedViewId)?.id ??
      loadedViews.find((view) => view.isAvailable)?.id ??
      loadedViews[0]?.id ??
      null;

    setSelectedViewId(nextId);
  }

  async function handleCreate(input: SavedViewInput): Promise<void> {
    setBusy(true);
    setErrorMessage(null);

    try {
      const created = await savedViewApi.create(input);

      await refreshViews(created.id);

      setIsAdding(false);

      setNotice(`${created.name} was created.`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate(input: SavedViewInput): Promise<void> {
    if (editingView === null) {
      return;
    }

    setBusy(true);
    setErrorMessage(null);

    try {
      const updated = await savedViewApi.update(editingView.id, input);

      await refreshViews(updated.id);

      setEditingView(null);

      setNotice(`${updated.name} was updated.`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(view: SavedView): Promise<void> {
    const confirmed = window.confirm(
      `Delete the ${view.name} saved view? No games will be deleted.`,
    );

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setErrorMessage(null);

    try {
      await savedViewApi.delete(view.id);

      await refreshViews();

      setEditingView(null);

      setNotice(`${view.name} was deleted. Your library was not changed.`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function moveView(viewId: string, direction: -1 | 1): Promise<void> {
    const currentIndex = views.findIndex((view) => view.id === viewId);
    const targetIndex = currentIndex + direction;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= views.length) {
      return;
    }

    const reorderedViews = [...views];
    const [movedView] = reorderedViews.splice(currentIndex, 1);

    if (movedView === undefined) return;

    reorderedViews.splice(targetIndex, 0, movedView);
    setBusy(true);
    setErrorMessage(null);

    try {
      const savedOrder = await savedViewApi.reorder(
        reorderedViews.map((view) => view.id),
      );

      setViews(savedOrder);
      setNotice("Saved-view order was updated.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  function selectView(view: SavedView) {
    setSelectedViewId(view.id);
    setLiveSearch("");
    setNotice(null);
  }

  function openCreateForm() {
    setIsAdding(true);
    setEditingView(null);
    setErrorMessage(null);
  }

  function openEditForm(view: SavedView) {
    setEditingView(view);
    setIsAdding(false);
    setErrorMessage(null);
  }

  function closeForm() {
    setIsAdding(false);
    setEditingView(null);
  }

  return (
    <section className="library-page" aria-labelledby="saved-views-title">
      <div className="library-heading">
        <div>
          <p className="eyebrow">Reusable backlog lenses</p>

          <h2 id="saved-views-title">Saved Views</h2>

          <p className="library-heading__description">
            See one library through focused plans, platforms, Collections, and
            completion states without duplicating a game.
          </p>
        </div>

        <button
          className="button button--primary"
          type="button"
          onClick={openCreateForm}
        >
          New saved view
        </button>
      </div>

      <div className="stats-strip" aria-label="Saved-view summary">
        <div>
          <strong>{views.length}</strong>

          <span>Total views</span>
        </div>

        <div>
          <strong>{summary.custom}</strong>

          <span>Custom views</span>
        </div>

        <div>
          <strong>{summary.available}</strong>

          <span>Available now</span>
        </div>

        <div>
          <strong>{summary.builtin}</strong>

          <span>Built-in views</span>
        </div>
      </div>

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

      {isAdding || editingView !== null ? (
        <div className="editor-panel">
          <SavedViewForm
            key={editingView?.id ?? "new-view"}
            initialView={editingView ?? undefined}
            collections={collections}
            onSubmit={editingView === null ? handleCreate : handleUpdate}
            onCancel={closeForm}
          />
        </div>
      ) : null}

      {loadState === "loading" ? (
        <div className="empty-state" role="status">
          <h3>Loading saved views…</h3>
        </div>
      ) : null}

      {loadState === "error" ? (
        <div className="empty-state">
          <h3>Saved views could not be loaded.</h3>

          <p>Check that the local API is running, then reload this page.</p>
        </div>
      ) : null}

      {loadState === "ready" ? (
        <div className="saved-view-layout">
          <div className="saved-view-list" aria-label="Saved views">
            {views.map((view, index) => (
              <article
                className={`saved-view-card${
                  selectedView?.id === view.id ? " saved-view-card--active" : ""
                }`}
                key={view.id}
              >
                <button
                  className="saved-view-card__selector"
                  type="button"
                  onClick={() => selectView(view)}
                >
                  <span className="saved-view-card__title-line">
                    <strong>{view.name}</strong>

                    <small>{view.isBuiltin ? "Built-in" : "Custom"}</small>
                  </span>

                  <span className="saved-view-card__summary">
                    {describeView(view, collections)}
                  </span>
                </button>

                <div className="saved-view-card__actions">
                  <div
                    className="saved-view-card__order"
                    aria-label={`Order ${view.name}`}
                  >
                    <button
                      className="order-button"
                      type="button"
                      disabled={busy || index === 0}
                      onClick={() => void moveView(view.id, -1)}
                      aria-label={`Move ${view.name} up`}
                    >
                      ↑
                    </button>

                    <span className="order-number">{index + 1}</span>

                    <button
                      className="order-button"
                      type="button"
                      disabled={busy || index === views.length - 1}
                      onClick={() => void moveView(view.id, 1)}
                      aria-label={`Move ${view.name} down`}
                    >
                      ↓
                    </button>
                  </div>

                  {view.isBuiltin ? null : (
                    <div className="saved-view-card__custom-actions">
                      <button
                        className="text-button"
                        type="button"
                        disabled={busy}
                        onClick={() => openEditForm(view)}
                      >
                        Edit
                      </button>

                      <button
                        className="text-button text-button--danger"
                        type="button"
                        disabled={busy}
                        onClick={() => void handleDelete(view)}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>

          <section
            className="saved-view-results"
            aria-labelledby="saved-view-results-title"
          >
            {selectedView === null ? null : (
              <>
                <div className="saved-view-results__heading">
                  <div>
                    <p className="eyebrow">Current view</p>

                    <h3 id="saved-view-results-title">{selectedView.name}</h3>

                    <p>{describeView(selectedView, collections)}</p>
                  </div>

                  {selectedView.isAvailable ? (
                    <span className="collection-count">
                      {games.length} games
                    </span>
                  ) : (
                    <span className="view-unavailable-badge">Unavailable</span>
                  )}
                </div>

                {!selectedView.isAvailable ? (
                  <div className="saved-view-unavailable">
                    <strong>Real trophy data is required for this view.</strong>

                    <p>
                      It will activate after trophy synchronization is built.
                      The app will not treat missing data as zero progress.
                    </p>
                  </div>
                ) : (
                  <>
                    <label className="search-field saved-view-results__search">
                      <span className="visually-hidden">
                        Search within this view
                      </span>

                      <input
                        type="search"
                        maxLength={200}
                        value={liveSearch}
                        onChange={(event) => setLiveSearch(event.target.value)}
                        placeholder="Search within this view"
                      />
                    </label>

                    {resultsLoading ? (
                      <p className="saved-view-results__message">
                        Updating results…
                      </p>
                    ) : games.length === 0 ? (
                      <div className="saved-view-results__empty">
                        <strong>No games match this view.</strong>

                        <span>
                          Change its filters or clear the temporary search.
                        </span>
                      </div>
                    ) : (
                      <div
                        className="saved-view-game-list"
                        aria-label={`${selectedView.name} games`}
                      >
                        {games.map((game) => (
                          <article className="saved-view-game" key={game.id}>
                            <div>
                              <strong>{game.title}</strong>

                              {game.notes === null ? null : <p>{game.notes}</p>}
                            </div>

                            <div className="saved-view-game__meta">
                              <span className="platform-badge">
                                {game.platform}
                              </span>

                              <span className="status-label">
                                {playStatusLabels[game.playStatus]}
                              </span>

                              {game.trophySummary === null ? (
                                <span className="trophy-placeholder">
                                  No trophy snapshot
                                </span>
                              ) : (
                                <>
                                  <span className="trophy-progress">
                                    <strong>
                                      {game.trophySummary.progressPercent}%
                                    </strong>

                                    <span>
                                      {totalTrophies(
                                        game.trophySummary.earnedTrophies,
                                      )}{" "}
                                      /{" "}
                                      {totalTrophies(
                                        game.trophySummary.totalTrophies,
                                      )}
                                    </span>
                                  </span>

                                  {game.trophySummary.platinumEarned ? (
                                    <span className="trophy-badge trophy-badge--platinum">
                                      Platinum
                                    </span>
                                  ) : null}

                                  {game.trophySummary.is100Percent &&
                                  !game.trophySummary.platinumEarned ? (
                                    <span className="trophy-badge trophy-badge--complete">
                                      100%
                                    </span>
                                  ) : null}
                                </>
                              )}

                              {game.isUnobtainable ? (
                                <span className="status-label status-label--unobtainable">
                                  Unobtainable
                                </span>
                              ) : null}

                              {game.hiddenAt === null ? null : (
                                <span className="hidden-badge">Hidden</span>
                              )}
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </>
                )}

                <p className="saved-view-results__sort">
                  Ordered by{" "}
                  {savedViewSortLabels[selectedView.sort.field].toLowerCase()} ·{" "}
                  {selectedView.sort.direction === "asc"
                    ? "ascending"
                    : "descending"}
                </p>
              </>
            )}
          </section>
        </div>
      ) : null}
    </section>
  );
}
