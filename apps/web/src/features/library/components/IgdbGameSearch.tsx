import { useMemo, useState, type FormEvent } from "react";
import {
  igdbSearchScopeLabels,
  igdbSearchScopes,
  type IgdbGameSearchResult,
  type IgdbSearchScope,
} from "../../../domain/igdb";
import {
  playStationPlatforms,
  playStatuses,
  playStatusLabels,
  type LibraryGame,
  type PlayStationPlatform,
  type PlayStatus,
} from "../../../domain/libraryGame";
import { ApiError } from "../../../services/api/apiClient";
import { igdbApi } from "../../../services/api/igdbApi";
import { IgdbMetadataOverview } from "./IgdbMetadataOverview";

interface IgdbGameSearchProps {
  readonly onAdded: (game: LibraryGame) => Promise<void>;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "Something unexpected went wrong while using IGDB.";
}

function IgdbCover({ game }: { readonly game: IgdbGameSearchResult }) {
  const [failed, setFailed] = useState(false);

  if (game.cover === null || failed) {
    return <div className="igdb-result__cover-placeholder">No cover</div>;
  }

  return (
    <img
      className="igdb-result__cover"
      src={game.cover.url}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

export function IgdbGameSearch({ onAdded }: IgdbGameSearchProps) {
  const [query, setQuery] = useState("");

  const [results, setResults] = useState<
    readonly IgdbGameSearchResult[] | null
  >(null);

  const [selectedExternalId, setSelectedExternalId] = useState<string | null>(
    null,
  );

  const [playStatus, setPlayStatus] = useState<PlayStatus>("not_started");

  const [platform, setPlatform] = useState<PlayStationPlatform | null>(null);

  const [scope, setScope] = useState<IgdbSearchScope>("games");

  const [isSearching, setIsSearching] = useState(false);

  const [addingKey, setAddingKey] = useState<string | null>(null);

  const [addedKeys, setAddedKeys] = useState<ReadonlySet<string>>(new Set());

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedGame = useMemo(
    () =>
      results?.find((game) => game.externalId === selectedExternalId) ?? null,
    [results, selectedExternalId],
  );

  function clearResults(): void {
    setResults(null);
    setSelectedExternalId(null);
  }

  async function handleSearch(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const normalizedQuery = query.trim();

    if (normalizedQuery.length < 2) {
      setErrorMessage("Enter at least two characters to search IGDB.");

      return;
    }

    setIsSearching(true);
    setErrorMessage(null);

    try {
      const loadedResults = await igdbApi.search(normalizedQuery, {
        platform,
        scope,
      });

      setResults(loadedResults);
      setSelectedExternalId(loadedResults[0]?.externalId ?? null);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSearching(false);
    }
  }

  async function handleAdd(
    game: IgdbGameSearchResult,
    selectedPlatform: PlayStationPlatform,
  ): Promise<void> {
    const key = `${game.externalId}:${selectedPlatform}`;

    setAddingKey(key);
    setErrorMessage(null);

    try {
      const createdGame = await igdbApi.addToLibrary(game.externalId, {
        platform: selectedPlatform,
        playStatus,
      });

      setAddedKeys((currentKeys) => new Set(currentKeys).add(key));

      await onAdded(createdGame);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setAddingKey(null);
    }
  }

  return (
    <section className="igdb-search" aria-label="IGDB game search">
      <form className="igdb-search__form" onSubmit={handleSearch}>
        <label className="search-field">
          <span className="visually-hidden">Search IGDB</span>

          <input
            data-dialog-initial-focus
            type="search"
            minLength={2}
            maxLength={100}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search for Astro Bot, Final Fantasy…"
          />
        </label>

        <button
          className="button button--primary"
          type="submit"
          disabled={isSearching}
        >
          {isSearching ? "Searching…" : "Search"}
        </button>
      </form>

      <div className="igdb-search__filters">
        <label className="field">
          <span>Platform</span>

          <select
            value={platform ?? "all"}
            onChange={(event) => {
              setPlatform(
                event.target.value === "all"
                  ? null
                  : (event.target.value as PlayStationPlatform),
              );

              clearResults();
            }}
          >
            <option value="all">All PlayStation platforms</option>

            {playStationPlatforms.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Result type</span>

          <select
            value={scope}
            onChange={(event) => {
              setScope(event.target.value as IgdbSearchScope);

              clearResults();
            }}
          >
            {igdbSearchScopes.map((option) => (
              <option key={option} value={option}>
                {igdbSearchScopeLabels[option]}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Add selected games as</span>

          <select
            value={playStatus}
            onChange={(event) =>
              setPlayStatus(event.target.value as PlayStatus)
            }
          >
            {playStatuses.map((status) => (
              <option key={status} value={status}>
                {playStatusLabels[status]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {errorMessage === null ? null : (
        <div className="notice notice--error" role="alert">
          {errorMessage}
        </div>
      )}

      {results === null ? (
        <p className="igdb-search__message">
          Search results will appear on the left. Select one to inspect its full
          metadata before adding it.
        </p>
      ) : null}

      {results !== null && results.length === 0 ? (
        <p className="igdb-search__message">
          IGDB returned no matching PS3, PS4, or PS5 releases.
        </p>
      ) : null}

      {results !== null && results.length > 0 ? (
        <div className="igdb-search__workspace">
          <section
            className="igdb-search__results-pane"
            aria-labelledby="igdb-results-title"
          >
            <div className="igdb-search__pane-heading">
              <h3 id="igdb-results-title">Results</h3>
              <span>{results.length}</span>
            </div>

            <div
              className="igdb-results"
              role="listbox"
              aria-label="IGDB search results"
            >
              {results.map((game) => {
                const selected = game.externalId === selectedExternalId;

                return (
                  <button
                    className={`igdb-result${
                      selected ? " igdb-result--selected" : ""
                    }`}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    key={game.externalId}
                    onClick={() => setSelectedExternalId(game.externalId)}
                  >
                    <IgdbCover game={game} />

                    <span className="igdb-result__content">
                      <span className="igdb-result__heading">
                        <strong>{game.title}</strong>

                        <span>{game.releaseDate?.slice(0, 4) ?? "TBA"}</span>
                      </span>

                      <span className="igdb-result__labels">
                        <span>{game.gameType.name ?? "Game"}</span>

                        {game.isDlc ? (
                          <span className="igdb-result__dlc-badge">Add-on</span>
                        ) : null}
                      </span>

                      <span className="igdb-result__summary">
                        {game.summary ?? "No summary is currently available."}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <aside
            className="igdb-search__details-pane"
            aria-label="Selected game details"
          >
            {selectedGame === null ? (
              <div className="igdb-search__selection-empty">
                Select a result to inspect its metadata.
              </div>
            ) : (
              <div className="game-details" key={selectedGame.externalId}>
                <IgdbMetadataOverview
                  title={selectedGame.title}
                  metadata={selectedGame}
                  badges={
                    <>
                      {selectedGame.platforms.map((gamePlatform) => (
                        <span className="platform-badge" key={gamePlatform}>
                          {gamePlatform}
                        </span>
                      ))}

                      <span className="status-label">
                        {selectedGame.gameType.name ?? "Game"}
                      </span>
                    </>
                  }
                  actions={
                    <div className="igdb-search__add-panel">
                      <div>
                        <strong>Add to Library</strong>

                        <span>Play Status: {playStatusLabels[playStatus]}</span>
                      </div>

                      <div className="igdb-search__add-actions">
                        {selectedGame.platforms.map((gamePlatform) => {
                          const key = `${selectedGame.externalId}:${gamePlatform}`;

                          const wasAdded = addedKeys.has(key);

                          return (
                            <button
                              className="button button--primary"
                              type="button"
                              key={gamePlatform}
                              disabled={addingKey !== null || wasAdded}
                              onClick={() =>
                                void handleAdd(selectedGame, gamePlatform)
                              }
                            >
                              {wasAdded
                                ? `${gamePlatform} added`
                                : addingKey === key
                                  ? `Adding ${gamePlatform}…`
                                  : `Add ${gamePlatform}`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  }
                />
              </div>
            )}
          </aside>
        </div>
      ) : null}
    </section>
  );
}
