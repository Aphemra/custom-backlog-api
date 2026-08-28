import { useState, type FormEvent } from "react";
import { IconButton } from "../../../components/ui/IconButton";
import { CloseIcon } from "../../../components/ui/icons";
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

interface IgdbGameSearchProps {
  readonly onAdded: (game: LibraryGame) => Promise<void>;
  readonly onClose: () => void;
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
      onError={() => setFailed(true)}
    />
  );
}

export function IgdbGameSearch({ onAdded, onClose }: IgdbGameSearchProps) {
  const [query, setQuery] = useState("");

  const [results, setResults] = useState<
    readonly IgdbGameSearchResult[] | null
  >(null);

  const [playStatus, setPlayStatus] = useState<PlayStatus>("not_started");
  const [platform, setPlatform] = useState<PlayStationPlatform | null>(null);
  const [scope, setScope] = useState<IgdbSearchScope>("games");

  const [isSearching, setIsSearching] = useState(false);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [addedKeys, setAddedKeys] = useState<ReadonlySet<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedQuery = query.trim();

    if (normalizedQuery.length < 2) {
      setErrorMessage("Enter at least two characters to search IGDB.");
      return;
    }

    setIsSearching(true);
    setErrorMessage(null);

    try {
      setResults(
        await igdbApi.search(normalizedQuery, {
          platform,
          scope,
        }),
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSearching(false);
    }
  }

  async function handleAdd(
    game: IgdbGameSearchResult,
    platform: PlayStationPlatform,
  ) {
    const key = `${game.externalId}:${platform}`;

    setAddingKey(key);
    setErrorMessage(null);

    try {
      const createdGame = await igdbApi.addToLibrary(game.externalId, {
        platform,
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
    <section className="igdb-search" aria-labelledby="igdb-search-title">
      <div className="game-form__heading">
        <div>
          <p className="eyebrow">IGDB metadata</p>

          <h2 id="igdb-search-title">Find a PlayStation game</h2>

          <p className="igdb-search__intro">
            Search PS3, PS4, and PS5 releases. Covers are stored locally when
            they first appear.
          </p>
        </div>

        <IconButton
          label="Close IGDB search"
          icon={<CloseIcon />}
          onClick={onClose}
        />
      </div>

      <form className="igdb-search__form" onSubmit={handleSearch}>
        <label className="search-field">
          <span className="visually-hidden">Search IGDB</span>

          <input
            autoFocus
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
              setResults(null);
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
              setResults(null);
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
          Results are not added automatically. Choose the correct platform on
          the game you want.
        </p>
      ) : null}

      {results !== null && results.length === 0 ? (
        <p className="igdb-search__message">
          IGDB returned no matching PS3, PS4, or PS5 releases.
        </p>
      ) : null}

      {results !== null && results.length > 0 ? (
        <div className="igdb-results" aria-live="polite">
          {results.map((game) => (
            <article className="igdb-result" key={game.externalId}>
              <IgdbCover game={game} />

              <div className="igdb-result__content">
                <div className="igdb-result__heading">
                  <h3>{game.title}</h3>

                  <div className="igdb-result__labels">
                    {game.isDlc ? (
                      <span className="igdb-result__dlc-badge">
                        {game.gameType.name ?? "Add-on"}
                      </span>
                    ) : null}

                    {game.releaseDate === null ? null : (
                      <span>{game.releaseDate.slice(0, 4)}</span>
                    )}
                  </div>
                </div>

                <p>
                  {game.summary ?? "IGDB does not currently provide a summary."}
                </p>

                <div className="igdb-result__actions">
                  {game.platforms.map((platform) => {
                    const key = `${game.externalId}:${platform}`;
                    const wasAdded = addedKeys.has(key);

                    return (
                      <button
                        className="button button--quiet"
                        type="button"
                        key={platform}
                        disabled={addingKey !== null || wasAdded}
                        onClick={() => void handleAdd(game, platform)}
                      >
                        {wasAdded
                          ? `${platform} added`
                          : addingKey === key
                            ? `Adding ${platform}…`
                            : `Add ${platform}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
