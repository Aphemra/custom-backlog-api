import { useEffect, useState } from "react";
import {
  backlogHistoryActionKinds,
  backlogHistoryActionSources,
  type BacklogHistoryActionKind,
  type BacklogHistoryActionSource,
  type BacklogHistoryPageResult,
  type TrophyHistorySortDirection,
} from "../../../domain/history";
import { playStatusLabels } from "../../../domain/libraryGame";
import { ApiError } from "../../../services/api/apiClient";
import { historyApi } from "../../../services/api/historyApi";

type LoadState = "loading" | "ready" | "error";
type ActionFilter = "all" | BacklogHistoryActionKind;
type SourceFilter = "all" | BacklogHistoryActionSource;

const pageSize = 25;
const numberFormatter = new Intl.NumberFormat();

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const actionLabels: Readonly<Record<BacklogHistoryActionKind, string>> = {
  game_added: "Game added",
  game_hidden: "Game hidden",
  game_unhidden: "Game restored",
  game_deleted: "Game deleted",
  play_status_changed: "Play status changed",
  game_platform_changed: "Platform changed",
  library_reordered: "Library reordered",
  trophy_marked_unobtainable: "Trophy marked unobtainable",
  trophy_restored: "Trophy restored",
  collection_created: "Collection created",
  collection_updated: "Collection updated",
  collection_deleted: "Collection deleted",
  collection_pinned: "Collection pinned",
  collection_unpinned: "Collection unpinned",
  collection_membership_changed: "Collection membership changed",
  collection_reordered: "Collections reordered",
  collection_games_reordered: "Collection games reordered",
  backlog_imported: "Backlog imported",
  backlog_deleted: "Backlog deleted",
};

const sourceLabels: Readonly<Record<BacklogHistoryActionSource, string>> = {
  user: "Manual change",
  playstation_sync: "PlayStation sync",
  portable_import: "Backup import",
  system: "Automatic",
};

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "Something unexpected went wrong while loading Backlog Activity.";
}

function activityCategory(
  action: BacklogHistoryActionKind,
): "game" | "collection" | "trophy" | "data" | "order" {
  if (action.startsWith("collection_")) {
    return "collection";
  }

  if (action.startsWith("trophy_")) {
    return "trophy";
  }

  if (action.startsWith("backlog_")) {
    return "data";
  }

  if (action === "library_reordered") {
    return "order";
  }

  return "game";
}

export function BacklogActivity() {
  const [action, setAction] = useState<ActionFilter>("all");
  const [source, setSource] = useState<SourceFilter>("all");
  const [direction, setDirection] =
    useState<TrophyHistorySortDirection>("desc");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<BacklogHistoryPageResult | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    void historyApi
      .listBacklogActivity(
        {
          ...(action === "all" ? {} : { action }),
          ...(source === "all" ? {} : { source }),
          direction,
          page,
          pageSize,
        },
        abortController.signal,
      )
      .then((loadedResult) => {
        if (!abortController.signal.aborted) {
          setResult(loadedResult);
          setErrorMessage(null);
          setLoadState("ready");
        }
      })
      .catch((error: unknown) => {
        if (!abortController.signal.aborted) {
          setErrorMessage(getErrorMessage(error));
          setLoadState("error");
        }
      });

    return () => abortController.abort();
  }, [action, direction, page, source]);

  function resetFilters(): void {
    setAction("all");
    setSource("all");
    setDirection("desc");
    setPage(1);
  }

  return (
    <div className="backlog-activity">
      <div className="backlog-activity__filters">
        <label className="field">
          <span>Action</span>

          <select
            value={action}
            onChange={(event) => {
              setAction(event.target.value as ActionFilter);
              setPage(1);
            }}
          >
            <option value="all">All backlog activity</option>

            {backlogHistoryActionKinds.map((actionKind) => (
              <option key={actionKind} value={actionKind}>
                {actionLabels[actionKind]}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Source</span>

          <select
            value={source}
            onChange={(event) => {
              setSource(event.target.value as SourceFilter);
              setPage(1);
            }}
          >
            <option value="all">All sources</option>

            {backlogHistoryActionSources.map((actionSource) => (
              <option key={actionSource} value={actionSource}>
                {sourceLabels[actionSource]}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Order</span>

          <select
            value={direction}
            onChange={(event) => {
              setDirection(event.target.value as TrophyHistorySortDirection);
              setPage(1);
            }}
          >
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
        </label>

        <button
          className="button button--quiet"
          type="button"
          onClick={resetFilters}
        >
          Reset
        </button>
      </div>

      {result === null ? null : (
        <div className="history-result-summary">
          <span>
            {numberFormatter.format(result.pagination.totalItems)} recorded{" "}
            {result.pagination.totalItems === 1 ? "change" : "changes"}
          </span>

          {result.pagination.totalPages > 0 ? (
            <span>
              Page {result.pagination.page} of {result.pagination.totalPages}
            </span>
          ) : null}
        </div>
      )}

      {loadState === "loading" ? (
        <div className="empty-state" role="status">
          <h3>Loading Backlog Activity…</h3>
        </div>
      ) : null}

      {loadState === "error" ? (
        <div className="empty-state">
          <h3>Backlog Activity could not be loaded.</h3>

          <p>{errorMessage}</p>
        </div>
      ) : null}

      {loadState === "ready" &&
      result !== null &&
      result.entries.length === 0 ? (
        <div className="empty-state">
          <h3>No backlog changes match these filters.</h3>

          <p>
            Backlog Activity records changes made after the history ledger was
            added. Earlier library actions cannot be reconstructed.
          </p>
        </div>
      ) : null}

      {loadState === "ready" && result !== null && result.entries.length > 0 ? (
        <div className="backlog-activity__list">
          {result.entries.map((entry) => (
            <article
              className={`backlog-activity-entry backlog-activity-entry--${activityCategory(
                entry.action,
              )}`}
              key={entry.id}
            >
              <div
                className="backlog-activity-entry__marker"
                aria-hidden="true"
              />

              <div className="backlog-activity-entry__content">
                <div className="backlog-activity-entry__heading">
                  <div>
                    <strong>{actionLabels[entry.action]}</strong>

                    <span>{sourceLabels[entry.source]}</span>
                  </div>

                  <time dateTime={entry.occurredAt}>
                    {dateFormatter.format(new Date(entry.occurredAt))}
                  </time>
                </div>

                <p>{entry.summary}</p>

                {entry.previousPlayStatus !== null &&
                entry.nextPlayStatus !== null ? (
                  <div className="backlog-activity-entry__transition">
                    <span>{playStatusLabels[entry.previousPlayStatus]}</span>

                    <span aria-hidden="true">→</span>

                    <strong>{playStatusLabels[entry.nextPlayStatus]}</strong>
                  </div>
                ) : null}

                {entry.gameTitle === null &&
                entry.collectionName === null ? null : (
                  <div className="backlog-activity-entry__subjects">
                    {entry.gameTitle === null ? null : (
                      <span>Game: {entry.gameTitle}</span>
                    )}

                    {entry.collectionName === null ? null : (
                      <span>Collection: {entry.collectionName}</span>
                    )}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {loadState === "ready" &&
      result !== null &&
      result.pagination.totalPages > 1 ? (
        <div className="history-pagination" aria-label="Backlog Activity pages">
          <button
            className="button button--quiet"
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((currentPage) => currentPage - 1)}
          >
            Previous
          </button>

          <span>
            Page {result.pagination.page} of {result.pagination.totalPages}
          </span>

          <button
            className="button button--quiet"
            type="button"
            disabled={page >= result.pagination.totalPages}
            onClick={() => setPage((currentPage) => currentPage + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
