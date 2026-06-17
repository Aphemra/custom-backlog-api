import { useState } from "react";
import { searchIgdbGames, type IgdbGameSearchResult } from "../../../services/api/igdbApi";
import { IgdbIntegrationStatusBadge } from "./IgdbIntegrationStatusBadge";

type IgdbSearchStatus = "idle" | "loading" | "success" | "error";

interface IgdbSearchPanelProps {
  onSelectGame: (game: IgdbGameSearchResult) => void;
}

export function IgdbSearchPanel({ onSelectGame }: IgdbSearchPanelProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<IgdbSearchStatus>("idle");
  const [results, setResults] = useState<IgdbGameSearchResult[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSearch() {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setStatus("error");
      setErrorMessage("Enter a game title to search.");
      setResults([]);
      return;
    }

    setStatus("loading");
    setErrorMessage(null);

    try {
      const response = await searchIgdbGames(trimmedQuery);

      setResults(response.games);
      setStatus("success");
    } catch {
      setResults([]);
      setStatus("error");
      setErrorMessage("Could not reach the mock IGDB endpoint. Make sure the API server is running.");
    }
  }

  return (
    <section className="igdb-search-panel" aria-label="Mock IGDB search">
      <div className="igdb-search-panel__header">
        <div>
          <h3>Search IGDB Source</h3>
          <p>Search the backend metadata endpoint and use a result to prefill this game.</p>
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

      {status === "success" && results.length === 0 ? <p className="helper-text">No mock IGDB results found.</p> : null}

      {results.length > 0 ? (
        <div className="igdb-result-list">
          {results.map((game) => (
            <article className="igdb-result-item" key={game.id}>
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
