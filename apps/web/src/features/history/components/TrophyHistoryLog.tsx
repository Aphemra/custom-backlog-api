import { type FormEvent, useEffect, useState } from "react";
import { TrophyGradeIcon } from "../../../components/ui/icons";
import type {
  TrophyHistoryLogResult,
  TrophyHistorySortDirection,
  TrophyHistoryTrophyType,
} from "../../../domain/history";
import type { PlayStationPlatform } from "../../../domain/libraryGame";
import { ApiError } from "../../../services/api/apiClient";
import { historyApi } from "../../../services/api/historyApi";

type LoadState = "loading" | "ready" | "error";
type PlatformFilter = "all" | PlayStationPlatform;
type TrophyTypeFilter = "all" | TrophyHistoryTrophyType;

const pageSize = 25;
const numberFormatter = new Intl.NumberFormat();

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "Something unexpected went wrong while loading the Trophy Log.";
}

function cachedImageUrl(imageId: string | null): string | null {
  return imageId === null ? null : `/api/images/${encodeURIComponent(imageId)}`;
}

function displayTrophyName(name: string | null, trophyId: number): string {
  return name ?? `Hidden trophy #${trophyId}`;
}

export function TrophyHistoryLog() {
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [trophyType, setTrophyType] = useState<TrophyTypeFilter>("all");
  const [direction, setDirection] =
    useState<TrophyHistorySortDirection>("desc");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<TrophyHistoryLogResult | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    void historyApi
      .listTrophies(
        {
          ...(appliedSearch.trim() === ""
            ? {}
            : { search: appliedSearch.trim() }),
          ...(platform === "all" ? {} : { platform }),
          ...(trophyType === "all" ? {} : { trophyType }),
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
  }, [appliedSearch, direction, page, platform, trophyType]);

  function applySearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(searchInput);
  }

  function clearFilters(): void {
    setSearchInput("");
    setAppliedSearch("");
    setPlatform("all");
    setTrophyType("all");
    setDirection("desc");
    setPage(1);
  }

  const totalPages = result?.pagination.totalPages ?? 0;

  return (
    <div className="history-log">
      <form className="history-log__filters" onSubmit={applySearch}>
        <label className="field history-log__search">
          <span>Search Trophy Log</span>

          <input
            type="search"
            value={searchInput}
            placeholder="Game, trophy, description, or platform…"
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </label>

        <label className="field">
          <span>Platform</span>

          <select
            value={platform}
            onChange={(event) => {
              setPlatform(event.target.value as PlatformFilter);
              setPage(1);
            }}
          >
            <option value="all">All platforms</option>
            <option value="PS3">PS3</option>
            <option value="PS4">PS4</option>
            <option value="PS5">PS5</option>
          </select>
        </label>

        <label className="field">
          <span>Trophy grade</span>

          <select
            value={trophyType}
            onChange={(event) => {
              setTrophyType(event.target.value as TrophyTypeFilter);
              setPage(1);
            }}
          >
            <option value="all">All trophies</option>
            <option value="bronze">Bronze</option>
            <option value="silver">Silver</option>
            <option value="gold">Gold</option>
            <option value="platinum">Platinum</option>
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

        <button className="button button--primary" type="submit">
          Search
        </button>

        <button
          className="button button--quiet"
          type="button"
          onClick={clearFilters}
        >
          Reset
        </button>
      </form>

      {result === null ? null : (
        <div className="history-result-summary">
          <span>
            {numberFormatter.format(result.pagination.totalItems)} earned{" "}
            {result.pagination.totalItems === 1 ? "trophy" : "trophies"}
          </span>

          {totalPages > 0 ? (
            <span>
              Page {result.pagination.page} of {totalPages}
            </span>
          ) : null}
        </div>
      )}

      {loadState === "loading" ? (
        <div className="empty-state" role="status">
          <h3>Loading earned trophies…</h3>
        </div>
      ) : null}

      {loadState === "error" ? (
        <div className="empty-state">
          <h3>The Trophy Log could not be loaded.</h3>

          <p>{errorMessage}</p>
        </div>
      ) : null}

      {loadState === "ready" &&
      result !== null &&
      result.trophies.length === 0 ? (
        <div className="empty-state">
          <h3>No trophies match these filters.</h3>

          <p>Change or reset the Trophy Log filters to try again.</p>
        </div>
      ) : null}

      {loadState === "ready" &&
      result !== null &&
      result.trophies.length > 0 ? (
        <div className="history-trophy-list">
          {result.trophies.map((trophy) => {
            const trophyImageUrl = cachedImageUrl(trophy.trophyIconImageId);
            const gameImageUrl = cachedImageUrl(trophy.gameArtworkImageId);

            return (
              <article
                className="history-trophy-row"
                key={`${trophy.gameId}:${trophy.trophyId}`}
              >
                <div className="history-trophy-row__artwork">
                  {gameImageUrl === null ? (
                    <span>{trophy.platform}</span>
                  ) : (
                    <img src={gameImageUrl} alt="" loading="lazy" />
                  )}
                </div>

                <div className="history-trophy-row__icon">
                  {trophyImageUrl === null ? (
                    <TrophyGradeIcon grade={trophy.trophyType} />
                  ) : (
                    <img src={trophyImageUrl} alt="" loading="lazy" />
                  )}
                </div>

                <div className="history-trophy-row__identity">
                  <div>
                    <strong>
                      {displayTrophyName(trophy.trophyName, trophy.trophyId)}
                    </strong>

                    <TrophyGradeIcon grade={trophy.trophyType} />
                  </div>

                  <span>{trophy.gameTitle}</span>

                  {trophy.trophyDetail === null ? null : (
                    <p>{trophy.trophyDetail}</p>
                  )}
                </div>

                <div className="history-trophy-row__sequence">
                  <span>#{numberFormatter.format(trophy.sequenceNumber)}</span>

                  <span className="platform-badge">{trophy.platform}</span>
                </div>

                <div className="history-trophy-row__earned">
                  <time dateTime={trophy.earnedAt}>
                    {dateFormatter.format(new Date(trophy.earnedAt))}
                  </time>

                  <span>
                    +{numberFormatter.format(trophy.pointsAwarded)} points
                  </span>
                </div>

                <div className="history-trophy-row__progression">
                  <strong>
                    Level {numberFormatter.format(trophy.calculatedLevel)}
                  </strong>

                  <span>
                    {numberFormatter.format(trophy.cumulativeTrophyCount)} total
                    trophies
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {loadState === "ready" &&
      result !== null &&
      result.pagination.totalPages > 1 ? (
        <div className="history-pagination" aria-label="Trophy Log pages">
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
