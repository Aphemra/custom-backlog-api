import { useState, type FormEvent } from "react";
import type { IgdbGameSearchResult } from "../../../domain/igdb";
import type {
  PlayStationLibraryCandidate,
  ReconciledPlayStationTitle,
} from "../../../domain/playStation";
import { ApiError } from "../../../services/api/apiClient";
import { igdbApi } from "../../../services/api/igdbApi";

interface PlayStationIgdbEnrichmentProps {
  readonly title: ReconciledPlayStationTitle;
  readonly candidate: PlayStationLibraryCandidate;
  readonly disabled: boolean;
  readonly onEnriched: () => void;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "Something unexpected went wrong while attaching IGDB metadata.";
}

function ResultCover({ result }: { readonly result: IgdbGameSearchResult }) {
  const [failed, setFailed] = useState(false);

  if (result.cover === null || failed) {
    return <div className="psn-igdb-result__cover-placeholder">No cover</div>;
  }

  return (
    <img
      className="psn-igdb-result__cover"
      src={result.cover.url}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

export function PlayStationIgdbEnrichment({
  title,
  candidate,
  disabled,
  onEnriched,
}: PlayStationIgdbEnrichmentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(title.name);

  const [results, setResults] = useState<
    readonly IgdbGameSearchResult[] | null
  >(null);

  const [isSearching, setIsSearching] = useState(false);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const compatibleResults =
    results?.filter((result) =>
      result.platforms.includes(candidate.platform),
    ) ?? null;

  async function search(): Promise<void> {
    const normalizedQuery = query.trim();

    if (normalizedQuery.length < 2) {
      setErrorMessage("Enter at least two characters to search IGDB.");
      return;
    }

    setIsSearching(true);
    setErrorMessage(null);

    try {
      setResults(await igdbApi.search(normalizedQuery, false));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSearching(false);
    }
  }

  async function handleSearch(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    await search();
  }

  async function handleEnrich(result: IgdbGameSearchResult): Promise<void> {
    setEnrichingId(result.externalId);
    setErrorMessage(null);

    try {
      await igdbApi.enrichExistingGame(result.externalId, candidate.gameId);

      onEnriched();
      setIsOpen(false);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setEnrichingId(null);
    }
  }

  if (!isOpen) {
    return (
      <button
        className="text-button"
        type="button"
        disabled={disabled}
        onClick={() => {
          setIsOpen(true);
          void search();
        }}
      >
        Find IGDB metadata
      </button>
    );
  }

  return (
    <section
      className="psn-igdb-enrichment"
      aria-label={`IGDB metadata for ${title.name}`}
    >
      <div className="psn-igdb-enrichment__heading">
        <div>
          <strong>Attach IGDB metadata</strong>

          <span>The selected result must support {candidate.platform}.</span>
        </div>

        <button
          className="icon-button"
          type="button"
          disabled={isSearching || enrichingId !== null}
          aria-label="Close IGDB metadata search"
          onClick={() => setIsOpen(false)}
        >
          ×
        </button>
      </div>

      <form
        className="psn-igdb-enrichment__search"
        onSubmit={(event) => void handleSearch(event)}
      >
        <label className="search-field">
          <span className="visually-hidden">Search IGDB for {title.name}</span>

          <input
            type="search"
            minLength={2}
            maxLength={100}
            value={query}
            disabled={isSearching || enrichingId !== null}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <button
          className="button button--quiet"
          type="submit"
          disabled={isSearching || enrichingId !== null}
        >
          {isSearching ? "Searching…" : "Search"}
        </button>
      </form>

      {errorMessage === null ? null : (
        <div className="notice notice--error" role="alert">
          {errorMessage}
        </div>
      )}

      {compatibleResults !== null && compatibleResults.length === 0 ? (
        <p className="psn-igdb-enrichment__empty">
          IGDB returned no {candidate.platform} games for this search.
        </p>
      ) : null}

      {compatibleResults !== null && compatibleResults.length > 0 ? (
        <div className="psn-igdb-results">
          {compatibleResults.map((result) => (
            <article className="psn-igdb-result" key={result.externalId}>
              <ResultCover result={result} />

              <div className="psn-igdb-result__content">
                <div>
                  <strong>{result.title}</strong>

                  <span>
                    {result.releaseDate === null
                      ? candidate.platform
                      : `${candidate.platform} · ${result.releaseDate.slice(0, 4)}`}
                  </span>
                </div>

                <p>{result.summary ?? "IGDB does not provide a summary."}</p>

                <button
                  className="button button--primary"
                  type="button"
                  disabled={enrichingId !== null}
                  onClick={() => void handleEnrich(result)}
                >
                  {enrichingId === result.externalId
                    ? "Attaching…"
                    : "Use this metadata"}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
