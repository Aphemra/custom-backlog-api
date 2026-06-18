import { useState } from "react";
import type { GameEntry } from "../../../domain/backlog";
import { searchIgdbGames, type IgdbGameSearchResult } from "../../../services/api/igdbApi";
import { filterAlreadyImportedIgdbSearchResults } from "../services/filterAlreadyImportedIgdbSearchResults";
import { IgdbIntegrationStatusBadge } from "./IgdbIntegrationStatusBadge";

type IgdbSearchStatus = "idle" | "loading" | "success" | "error";

const VISIBLE_RESULT_LIMIT = 10;
const SEARCH_CANDIDATE_LIMIT = 25;

interface IgdbSearchPanelProps {
  existingGameEntries: GameEntry[];
  onSelectGame: (game: IgdbGameSearchResult) => void;
}

export function IgdbSearchPanel({ existingGameEntries, onSelectGame }: IgdbSearchPanelProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<IgdbSearchStatus>("idle");
  const [results, setResults] = useState<IgdbGameSearchResult[]>([]);
  const [hiddenImportedCount, setHiddenImportedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSearch() {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setStatus("error");
      setErrorMessage("Enter a game title to search.");
      setResults([]);
      setHiddenImportedCount(0);
      return;
    }

    setStatus("loading");
    setErrorMessage(null);

    try {
      const response = await searchIgdbGames(trimmedQuery, SEARCH_CANDIDATE_LIMIT);

      const filteredResults = filterAlreadyImportedIgdbSearchResults(response.games, existingGameEntries);

      setResults(filteredResults.visibleResults.slice(0, VISIBLE_RESULT_LIMIT));
      setHiddenImportedCount(filteredResults.hiddenResults.length);
      setStatus("success");
    } catch {
      setResults([]);
      setHiddenImportedCount(0);
      setStatus("error");
      setErrorMessage("Could not reach the IGDB metadata endpoint. Make sure the API server is running.");
    }
  }

  return (
    <section className="igdb-search-panel" aria-label="IGDB metadata search">
      <div className="igdb-search-panel__header">
        <div>
          <h3>Search PlayStation Metadata</h3>
          <p>Search the backend metadata endpoint for PlayStation-compatible results.</p>
        </div>

        <IgdbIntegrationStatusBadge />
      </div>

      <div className="igdb-search-form">
        <input
          className="search-input"
          type="search"
          placeholder="Persona, Final Fantasy, Yakuza..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleSearch();
            }
          }}
        />

        <button
          className="button"
          type="button"
          disabled={status === "loading"}
          onClick={() => {
            void handleSearch();
          }}
        >
          {status === "loading" ? "Searching..." : "Search"}
        </button>
      </div>

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

      {status === "success" && results.length === 0 ? (
        <p className="helper-text">
          No new metadata results found.
          {hiddenImportedCount > 0 ? ` ${hiddenImportedCount} already-imported result(s) were hidden.` : ""}
        </p>
      ) : null}

      {status === "success" && results.length > 0 && hiddenImportedCount > 0 ? (
        <p className="helper-text">Hidden {hiddenImportedCount} already-imported result(s) from this search.</p>
      ) : null}

      {results.length > 0 ? (
        <div className="igdb-result-list">
          {results.map((game) => (
            <article className="igdb-result-item" key={game.id}>
              {game.coverUrl ? (
                <img className="igdb-result-item__cover" src={game.coverUrl} alt={`Cover for ${game.name}`} />
              ) : (
                <div className="igdb-result-item__cover-placeholder" aria-hidden="true">
                  No Cover
                </div>
              )}

              <div>
                <strong>{game.name}</strong>

                <p className="igdb-result-item__meta">{formatIgdbGameMeta(game)}</p>
              </div>

              <button className="button button--primary" type="button" onClick={() => onSelectGame(game)}>
                Use
              </button>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function formatIgdbGameMeta(game: IgdbGameSearchResult): string {
  const sourceText = game.source === "igdb" ? "IGDB" : "Mock IGDB";

  const platformText = game.platforms.length > 0 ? game.platforms.join(" / ") : "Platforms unknown";

  if (game.firstReleaseYear === undefined) {
    return `${sourceText} • ${platformText}`;
  }

  return `${sourceText} • ${platformText} • ${game.firstReleaseYear}`;
}
