import { useEffect, useMemo, useState } from "react";
import type {
  PlayStationConnectionStatus,
  PlayStationLibraryCandidate,
  PlayStationReconciliationStatus,
  PlayStationTitlePreview,
  ReconciledPlayStationTitle,
} from "../../../domain/playStation";
import { ApiError } from "../../../services/api/apiClient";
import { playStationApi } from "../../../services/api/playStationApi";

type PreviewFilter = "all" | PlayStationReconciliationStatus;

const filterLabels: Readonly<Record<PreviewFilter, string>> = {
  all: "All",
  linked: "Linked",
  suggested_match: "Suggested",
  ambiguous: "Ambiguous",
  new: "New",
};

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "Something unexpected went wrong while handling PlayStation data.";
}

function totalTrophies(
  counts: ReconciledPlayStationTitle["definedTrophies"],
): number {
  return counts.bronze + counts.silver + counts.gold + counts.platinum;
}

function earnedTrophies(
  counts: ReconciledPlayStationTitle["earnedTrophies"],
): number {
  return counts.bronze + counts.silver + counts.gold + counts.platinum;
}

function statusLabel(status: PlayStationReconciliationStatus): string {
  switch (status) {
    case "linked":
      return "Linked";

    case "suggested_match":
      return "Suggested match";

    case "ambiguous":
      return "Needs review";

    case "new":
      return "Not in library";
  }
}

function updateLinkedTitle(
  preview: PlayStationTitlePreview,
  title: ReconciledPlayStationTitle,
  candidate: PlayStationLibraryCandidate,
): PlayStationTitlePreview {
  const titles = preview.titles.map((existingTitle) => {
    if (
      existingTitle.npServiceName !== title.npServiceName ||
      existingTitle.npCommunicationId !== title.npCommunicationId
    ) {
      return existingTitle;
    }

    return {
      ...existingTitle,
      reconciliation: {
        status: "linked" as const,
        candidates: [candidate],
      },
    };
  });

  return {
    ...preview,
    titles,
    reconciliationCounts: {
      ...preview.reconciliationCounts,
      linked: preview.reconciliationCounts.linked + 1,
      suggestedMatch: preview.reconciliationCounts.suggestedMatch - 1,
    },
  };
}

interface TrophyTitleRowProps {
  readonly title: ReconciledPlayStationTitle;
  readonly linkingIdentity: string | null;
  readonly onConfirmSuggestedMatch: (
    title: ReconciledPlayStationTitle,
    candidate: PlayStationLibraryCandidate,
  ) => void;
}

function TrophyTitleRow({
  title,
  linkingIdentity,
  onConfirmSuggestedMatch,
}: TrophyTitleRowProps) {
  const identity = `${title.npServiceName}:${title.npCommunicationId}`;

  const suggestedCandidate =
    title.reconciliation.status === "suggested_match"
      ? title.reconciliation.candidates[0]
      : undefined;

  const earned = earnedTrophies(title.earnedTrophies);
  const total = totalTrophies(title.definedTrophies);

  return (
    <article className="psn-title-row">
      <div
        className="psn-title-row__progress"
        aria-label={`${title.progress}% complete`}
      >
        <strong>{title.progress}%</strong>

        <span
          style={{
            height: `${Math.max(3, title.progress)}%`,
          }}
        />
      </div>

      <div className="psn-title-row__content">
        <div className="psn-title-row__heading">
          <div>
            <h3>{title.name}</h3>

            <div className="psn-title-row__platforms">
              {title.platforms.map((platform) => (
                <span className="platform-badge" key={platform}>
                  {platform}
                </span>
              ))}

              {title.hasTrophyGroups ? (
                <span className="psn-title-row__dlc">Additional groups</span>
              ) : null}
            </div>
          </div>

          <span
            className={`psn-match-badge psn-match-badge--${title.reconciliation.status}`}
          >
            {statusLabel(title.reconciliation.status)}
          </span>
        </div>

        <div className="psn-title-row__summary">
          <span>
            <strong>{earned}</strong> / {total} trophies
          </span>

          <span>
            {title.earnedTrophies.platinum} / {title.definedTrophies.platinum}{" "}
            platinum
          </span>

          <span>
            Updated{" "}
            {new Intl.DateTimeFormat(undefined, {
              dateStyle: "medium",
            }).format(new Date(title.lastUpdatedAt))}
          </span>
        </div>

        {title.reconciliation.status === "linked" ? (
          <p className="psn-title-row__match">
            Linked to{" "}
            <strong>
              {title.reconciliation.candidates[0]?.title ?? "a library game"}
            </strong>
          </p>
        ) : null}

        {suggestedCandidate === undefined ? null : (
          <div className="psn-title-row__suggestion">
            <div>
              <span>Suggested local match</span>

              <strong>
                {suggestedCandidate.title} · {suggestedCandidate.platform}
                {suggestedCandidate.archived ? " · Archived" : ""}
              </strong>
            </div>

            <button
              className="button button--primary"
              type="button"
              disabled={linkingIdentity !== null}
              onClick={() => onConfirmSuggestedMatch(title, suggestedCandidate)}
            >
              {linkingIdentity === identity ? "Linking…" : "Confirm link"}
            </button>
          </div>
        )}

        {title.reconciliation.status === "ambiguous" ? (
          <p className="psn-title-row__match psn-title-row__match--warning">
            Multiple local games match this title. Manual selection comes in the
            next pass.
          </p>
        ) : null}

        {title.reconciliation.status === "new" ? (
          <p className="psn-title-row__match">
            No compatible local game has the same normalized title.
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function PlayStationPage() {
  const [status, setStatus] = useState<PlayStationConnectionStatus | null>(
    null,
  );

  const [preview, setPreview] = useState<PlayStationTitlePreview | null>(null);

  const [activeFilter, setActiveFilter] = useState<PreviewFilter>("all");

  const [searchQuery, setSearchQuery] = useState("");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [linkingIdentity, setLinkingIdentity] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    async function loadStatus() {
      try {
        const loadedStatus = await playStationApi.getStatus(
          abortController.signal,
        );

        if (!abortController.signal.aborted) {
          setStatus(loadedStatus);
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          setErrorMessage(getErrorMessage(error));
        }
      }
    }

    void loadStatus();

    return () => abortController.abort();
  }, []);

  const visibleTitles = useMemo(() => {
    if (preview === null) {
      return [];
    }

    const normalizedQuery = searchQuery.trim().toLocaleLowerCase("en-US");

    return preview.titles.filter((title) => {
      if (
        activeFilter !== "all" &&
        title.reconciliation.status !== activeFilter
      ) {
        return false;
      }

      return (
        normalizedQuery.length === 0 ||
        title.name.toLocaleLowerCase("en-US").includes(normalizedQuery)
      );
    });
  }, [activeFilter, preview, searchQuery]);

  async function handlePreview(): Promise<void> {
    setIsPreviewing(true);
    setErrorMessage(null);
    setNotice(null);

    try {
      const loadedPreview = await playStationApi.previewTitles();

      setPreview(loadedPreview);
      setActiveFilter("all");

      setNotice(
        `Read ${loadedPreview.supportedTitleCount} supported trophy titles using ${loadedPreview.requestsMade} PlayStation requests.`,
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleConfirmSuggestedMatch(
    title: ReconciledPlayStationTitle,
    candidate: PlayStationLibraryCandidate,
  ): Promise<void> {
    const identity = `${title.npServiceName}:${title.npCommunicationId}`;

    setLinkingIdentity(identity);
    setErrorMessage(null);
    setNotice(null);

    try {
      await playStationApi.linkTitle({
        gameId: candidate.gameId,
        npServiceName: title.npServiceName,
        npCommunicationId: title.npCommunicationId,
      });

      setPreview((currentPreview) =>
        currentPreview === null
          ? null
          : updateLinkedTitle(currentPreview, title, candidate),
      );

      setNotice(`${title.name} was linked to ${candidate.title}.`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLinkingIdentity(null);
    }
  }

  const counts = preview?.reconciliationCounts;

  return (
    <section className="library-page" aria-labelledby="playstation-title">
      <div className="library-heading">
        <div>
          <p className="eyebrow">Reader-account integration</p>

          <h2 id="playstation-title">PlayStation</h2>

          <p className="library-heading__description">
            Preview your trophy history, compare it with the local library, and
            confirm matches before anything is linked.
          </p>
        </div>

        <button
          className="button button--primary"
          type="button"
          disabled={
            status?.configured !== true ||
            isPreviewing ||
            linkingIdentity !== null
          }
          onClick={() => void handlePreview()}
        >
          {isPreviewing
            ? "Reading PlayStation titles…"
            : preview === null
              ? "Preview trophy library"
              : "Refresh preview"}
        </button>
      </div>

      <div className="psn-connection-card">
        <div>
          <span>Reader account</span>
          <strong>{status?.readerOnlineId ?? "Not configured"}</strong>
        </div>

        <div>
          <span>Target account</span>
          <strong>{status?.targetOnlineId ?? "Not configured"}</strong>
        </div>

        <span
          className={`status-pill${
            status?.configured === true ? "" : " status-pill--warning"
          }`}
        >
          {status === null
            ? "Checking local settings…"
            : status.configured
              ? "Configured"
              : "Configuration incomplete"}
        </span>
      </div>

      {errorMessage === null ? null : (
        <div className="notice notice--error" role="alert">
          {errorMessage}
        </div>
      )}

      {notice === null ? null : (
        <div className="notice notice--success" role="status">
          {notice}
        </div>
      )}

      {preview === null ? (
        <div className="empty-state">
          <h3>No trophy preview loaded.</h3>

          <p>
            Nothing contacts PlayStation until you deliberately request a
            preview.
          </p>
        </div>
      ) : (
        <>
          <div className="stats-strip psn-stats">
            <div>
              <strong>{preview.supportedTitleCount}</strong>
              <span>Supported titles</span>
            </div>

            <div>
              <strong>{counts?.linked ?? 0}</strong>
              <span>Linked</span>
            </div>

            <div>
              <strong>{counts?.suggestedMatch ?? 0}</strong>
              <span>Suggested</span>
            </div>

            <div>
              <strong>{counts?.ambiguous ?? 0}</strong>
              <span>Needs review</span>
            </div>

            <div>
              <strong>{counts?.new ?? 0}</strong>
              <span>New</span>
            </div>
          </div>

          <div className="psn-preview-controls">
            <label className="search-field">
              <span className="visually-hidden">Search PlayStation titles</span>

              <input
                type="search"
                value={searchQuery}
                placeholder="Search trophy titles…"
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>

            <div className="psn-filter-list" aria-label="Reconciliation filter">
              {(Object.keys(filterLabels) as PreviewFilter[]).map((filter) => (
                <button
                  className={`psn-filter${
                    activeFilter === filter ? " psn-filter--active" : ""
                  }`}
                  type="button"
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                >
                  {filterLabels[filter]}
                </button>
              ))}
            </div>
          </div>

          <p className="helper-message">
            Showing {visibleTitles.length} of {preview.supportedTitleCount}{" "}
            supported titles. {preview.excludedTitleCount} unsupported platform
            titles were excluded.
          </p>

          {visibleTitles.length === 0 ? (
            <div className="empty-state">
              <h3>No trophy titles match this view.</h3>
              <p>Try another filter or clear the search.</p>
            </div>
          ) : (
            <div
              className="psn-title-list"
              aria-label="PlayStation trophy titles"
            >
              {visibleTitles.map((title) => (
                <TrophyTitleRow
                  key={`${title.npServiceName}:${title.npCommunicationId}`}
                  title={title}
                  linkingIdentity={linkingIdentity}
                  onConfirmSuggestedMatch={(selectedTitle, candidate) =>
                    void handleConfirmSuggestedMatch(selectedTitle, candidate)
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
