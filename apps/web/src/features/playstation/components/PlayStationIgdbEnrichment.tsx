import { useState, type FormEvent } from "react";
import { Dialog } from "../../../components/ui/Dialog";
import type { IgdbGameSearchResult } from "../../../domain/igdb";
import type {
  PlayStationLibraryCandidate,
  ReconciledPlayStationTitle,
} from "../../../domain/playStation";
import { ApiError } from "../../../services/api/apiClient";
import { igdbApi } from "../../../services/api/igdbApi";
import { IgdbMetadataOverview } from "../../library/components/IgdbMetadataOverview";

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

function createInitialSearchQuery(title: string): string {
  return title
    .replace(/[©®™℠]/gu, "")
    .normalize("NFKC")
    .replace(/\s*(?:[-–—:|]\s*)?(?:trophy\s+list|trophies)\s*$/iu, "")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  const [query, setQuery] = useState(createInitialSearchQuery(title.name));

  const [results, setResults] = useState<
    readonly IgdbGameSearchResult[] | null
  >(null);

  const [selectedExternalId, setSelectedExternalId] = useState<string | null>(
    null,
  );

  const [includeEditions, setIncludeEditions] = useState(false);

  const [isSearching, setIsSearching] = useState(false);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const compatibleResults =
    results?.filter((result) =>
      result.platforms.includes(candidate.platform),
    ) ?? null;

  const selectedResult =
    compatibleResults?.find(
      (result) => result.externalId === selectedExternalId,
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
      const loadedResults = await igdbApi.search(normalizedQuery, {
        platform: candidate.platform,
        scope: includeEditions ? "editions" : "games",
      });

      const loadedCompatibleResults = loadedResults.filter((result) =>
        result.platforms.includes(candidate.platform),
      );

      setResults(loadedResults);
      setSelectedExternalId(loadedCompatibleResults[0]?.externalId ?? null);
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

  return (
    <>
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

      <Dialog
        open={isOpen}
        title={`Attach IGDB metadata to ${candidate.title}`}
        description={`Search for the matching ${candidate.platform} release, inspect its complete metadata, and attach it to this imported trophy list.`}
        size="xlarge"
        dismissible={!isSearching && enrichingId === null}
        onClose={() => setIsOpen(false)}
      >
        <section
          className="psn-igdb-enrichment"
          aria-label={`IGDB metadata for ${title.name}`}
        >
          <form
            className="psn-igdb-enrichment__search"
            onSubmit={(event) => void handleSearch(event)}
          >
            <label className="search-field">
              <span className="visually-hidden">
                Search IGDB for {title.name}
              </span>

              <input
                data-dialog-initial-focus
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

          <label className="checkbox-control psn-igdb-enrichment__edition-toggle">
            <input
              type="checkbox"
              checked={includeEditions}
              disabled={isSearching || enrichingId !== null}
              onChange={(event) => {
                setIncludeEditions(event.target.checked);
                setResults(null);
                setSelectedExternalId(null);
              }}
            />

            <span>Include editions, compilations, and bundles</span>
          </label>

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
            <div className="psn-igdb-enrichment__workspace">
              <section
                className="psn-igdb-enrichment__results-pane"
                aria-label="IGDB matching results"
              >
                <div className="psn-igdb-enrichment__pane-heading">
                  <h3>Results</h3>

                  <span>{compatibleResults.length}</span>
                </div>

                <div
                  className="psn-igdb-results"
                  role="listbox"
                  aria-label={`IGDB matches for ${title.name}`}
                >
                  {compatibleResults.map((result) => {
                    const selected = result.externalId === selectedExternalId;

                    return (
                      <button
                        className={`psn-igdb-result${
                          selected ? " psn-igdb-result--selected" : ""
                        }`}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        key={result.externalId}
                        disabled={enrichingId !== null}
                        onClick={() => setSelectedExternalId(result.externalId)}
                      >
                        <ResultCover result={result} />

                        <span className="psn-igdb-result__content">
                          <span className="psn-igdb-result__heading">
                            <strong>{result.title}</strong>

                            <span>
                              {result.releaseDate === null
                                ? candidate.platform
                                : `${candidate.platform} · ${result.releaseDate.slice(0, 4)}`}
                            </span>
                          </span>

                          <span className="psn-igdb-result__summary">
                            {result.summary ??
                              "IGDB does not provide a summary."}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <aside
                className="psn-igdb-enrichment__details-pane"
                aria-label="Selected IGDB metadata"
              >
                {selectedResult === null ? (
                  <div className="psn-igdb-enrichment__selection-empty">
                    Select a result to inspect its metadata.
                  </div>
                ) : (
                  <div className="game-details" key={selectedResult.externalId}>
                    <IgdbMetadataOverview
                      title={selectedResult.title}
                      metadata={selectedResult}
                      badges={
                        <>
                          <span className="platform-badge">
                            {candidate.platform}
                          </span>

                          <span className="status-label">
                            {selectedResult.gameType.name ?? "Game"}
                          </span>
                        </>
                      }
                      actions={
                        <div className="psn-igdb-enrichment__attach-panel">
                          <span>Attach this metadata to</span>

                          <strong>{candidate.title}</strong>

                          <button
                            className="button button--primary"
                            type="button"
                            disabled={enrichingId !== null}
                            onClick={() => void handleEnrich(selectedResult)}
                          >
                            {enrichingId === selectedResult.externalId
                              ? "Attaching…"
                              : "Use this metadata"}
                          </button>
                        </div>
                      }
                    />
                  </div>
                )}
              </aside>
            </div>
          ) : null}
        </section>
      </Dialog>
    </>
  );
}
