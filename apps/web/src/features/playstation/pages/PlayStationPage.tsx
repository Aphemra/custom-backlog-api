import { useEffect, useMemo, useState } from "react";
import {
  playStatuses,
  playStatusLabels,
  type LibraryGame,
  type PlayStationPlatform,
  type PlayStatus,
} from "../../../domain/libraryGame";
import { PlayStationIgdbEnrichment } from "../components/PlayStationIgdbEnrichment";
import { PlayStationSyncProgressPanel } from "../components/PlayStationSyncProgressPanel";
import { usePlayStationSyncProgress } from "../hooks/usePlayStationSyncProgress";
import type {
  PlayStationConnectionStatus,
  PlayStationLibraryCandidate,
  PlayStationReconciliationStatus,
  PlayStationTitlePreview,
  ReconciledPlayStationTitle,
  PlayStationSyncResult,
  PlayStationTrophyDetailSynchronizationResult,
} from "../../../domain/playStation";
import { ApiError } from "../../../services/api/apiClient";
import { playStationApi } from "../../../services/api/playStationApi";
import { libraryApi } from "../../../services/api/libraryApi";

type PreviewFilter = "all" | "missing_igdb" | PlayStationReconciliationStatus;

const filterLabels: Readonly<Record<PreviewFilter, string>> = {
  new: "New",
  missing_igdb: "Missing IGDB",
  all: "All",
  linked: "Linked",
  suggested_match: "Suggested",
  ambiguous: "Ambiguous",
};

function isMissingIgdbMetadata(title: ReconciledPlayStationTitle): boolean {
  if (title.reconciliation.status !== "linked") {
    return false;
  }

  const linkedCandidate = title.reconciliation.candidates[0];

  return (
    linkedCandidate !== undefined && linkedCandidate.metadataProvider === null
  );
}

function titleMatchesPreviewFilter(
  title: ReconciledPlayStationTitle,
  filter: PreviewFilter,
): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "missing_igdb") {
    return isMissingIgdbMetadata(title);
  }

  return title.reconciliation.status === filter;
}

function choosePreferredPreviewFilter(
  preview: PlayStationTitlePreview,
): PreviewFilter {
  if (preview.reconciliationCounts.new > 0) {
    return "new";
  }

  if (preview.titles.some(isMissingIgdbMetadata)) {
    return "missing_igdb";
  }

  return "all";
}

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
  const previousStatus = title.reconciliation.status;

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
      linked: preview.reconciliationCounts.linked + 1,
      suggestedMatch:
        preview.reconciliationCounts.suggestedMatch -
        (previousStatus === "suggested_match" ? 1 : 0),
      ambiguous:
        preview.reconciliationCounts.ambiguous -
        (previousStatus === "ambiguous" ? 1 : 0),
      new:
        preview.reconciliationCounts.new - (previousStatus === "new" ? 1 : 0),
    },
  };
}

interface TrophyTitleRowProps {
  readonly title: ReconciledPlayStationTitle;
  readonly availableCandidates: readonly PlayStationLibraryCandidate[];
  readonly selectedCandidateId: string;
  readonly busyIdentity: string | null;
  readonly onSelectCandidate: (titleIdentity: string, gameId: string) => void;
  readonly onConfirmMatch: (
    title: ReconciledPlayStationTitle,
    candidate: PlayStationLibraryCandidate,
  ) => void;
  readonly onImportTitle: (
    title: ReconciledPlayStationTitle,
    platform: PlayStationPlatform,
    playStatus: PlayStatus,
  ) => void;
  readonly onMetadataEnriched: (
    title: ReconciledPlayStationTitle,
    candidate: PlayStationLibraryCandidate,
  ) => void;
}

function TrophyTitleRow({
  title,
  availableCandidates,
  selectedCandidateId,
  busyIdentity,
  onSelectCandidate,
  onConfirmMatch,
  onImportTitle,
  onMetadataEnriched,
}: TrophyTitleRowProps) {
  const identity = `${title.npServiceName}:${title.npCommunicationId}`;

  const [importPlatform, setImportPlatform] = useState<PlayStationPlatform>(
    title.platforms[0] ?? "PS5",
  );

  const [importPlayStatus, setImportPlayStatus] =
    useState<PlayStatus>("not_started");

  const suggestedCandidate =
    title.reconciliation.status === "suggested_match"
      ? title.reconciliation.candidates[0]
      : undefined;

  const linkedCandidate =
    title.reconciliation.status === "linked"
      ? title.reconciliation.candidates[0]
      : undefined;

  const canEnrichFromIgdb =
    linkedCandidate?.playStationLinkSource === "sync_created" &&
    linkedCandidate.metadataProvider === null;

  const selectedCandidate = availableCandidates.find(
    (candidate) => candidate.gameId === selectedCandidateId,
  );

  const exactCandidateIds = new Set(
    title.reconciliation.candidates.map((candidate) => candidate.gameId),
  );

  const needsManualSelection =
    title.reconciliation.status === "ambiguous" ||
    title.reconciliation.status === "new";

  const canCreateLibraryGame =
    title.reconciliation.status === "ambiguous" ||
    title.reconciliation.status === "new";

  const earned = earnedTrophies(title.earnedTrophies);
  const total = totalTrophies(title.definedTrophies);

  return (
    <article className="psn-title-row">
      <div className="psn-title-row__art">
        {title.cachedIcon === null ? (
          <span aria-hidden="true">
            {title.name.slice(0, 1).toLocaleUpperCase("en-US")}
          </span>
        ) : (
          <img
            src={title.cachedIcon.url}
            alt=""
            loading="lazy"
            decoding="async"
          />
        )}
      </div>

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

        {linkedCandidate === undefined ? null : (
          <>
            <p className="psn-title-row__match">
              Linked to <strong>{linkedCandidate.title}</strong>
              {linkedCandidate.metadataProvider === null
                ? ""
                : ` · ${linkedCandidate.metadataProvider.toUpperCase()} metadata`}
            </p>

            {canEnrichFromIgdb ? (
              <PlayStationIgdbEnrichment
                title={title}
                candidate={linkedCandidate}
                disabled={busyIdentity !== null}
                onEnriched={() => onMetadataEnriched(title, linkedCandidate)}
              />
            ) : null}
          </>
        )}

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
              disabled={busyIdentity !== null}
              onClick={() => onConfirmMatch(title, suggestedCandidate)}
            >
              {busyIdentity === identity ? "Linking…" : "Confirm link"}
            </button>
          </div>
        )}

        {needsManualSelection ? (
          <div className="psn-title-row__manual-match">
            <div>
              <span>
                {title.reconciliation.status === "ambiguous"
                  ? "Choose the correct local game"
                  : "Link to an existing local game"}
              </span>

              <small>
                {title.reconciliation.status === "ambiguous"
                  ? `${title.reconciliation.candidates.length} exact title matches were found.`
                  : "No exact title match was found, but you can override that judgment."}
              </small>
            </div>

            {availableCandidates.length === 0 ? (
              <p>
                No unlinked {title.platforms.join(" / ")} library games are
                available.
              </p>
            ) : (
              <div className="psn-title-row__manual-controls">
                <label>
                  <span className="visually-hidden">
                    Select a local game for {title.name}
                  </span>

                  <select
                    value={selectedCandidateId}
                    disabled={busyIdentity !== null}
                    onChange={(event) =>
                      onSelectCandidate(identity, event.target.value)
                    }
                  >
                    <option value="">Select a local game…</option>

                    {availableCandidates.map((candidate) => (
                      <option value={candidate.gameId} key={candidate.gameId}>
                        {candidate.title} · {candidate.platform}
                        {exactCandidateIds.has(candidate.gameId)
                          ? " · Exact title match"
                          : ""}
                        {candidate.archived ? " · Archived" : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  className="button button--primary"
                  type="button"
                  disabled={
                    busyIdentity !== null || selectedCandidate === undefined
                  }
                  onClick={() => {
                    if (selectedCandidate !== undefined) {
                      onConfirmMatch(title, selectedCandidate);
                    }
                  }}
                >
                  {busyIdentity === identity
                    ? "Linking…"
                    : "Link selected game"}
                </button>
              </div>
            )}
          </div>
        ) : null}

        {canCreateLibraryGame ? (
          <div className="psn-title-row__import">
            <div>
              <span>Create a separate library game</span>

              <small>
                Uses the PSN trophy title now. IGDB metadata can be attached
                afterward.
              </small>
            </div>

            <div className="psn-title-row__import-controls">
              <label className="field">
                <span>Platform</span>

                <select
                  value={importPlatform}
                  disabled={busyIdentity !== null}
                  onChange={(event) =>
                    setImportPlatform(event.target.value as PlayStationPlatform)
                  }
                >
                  {title.platforms.map((platform) => (
                    <option value={platform} key={platform}>
                      {platform}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Play status</span>

                <select
                  value={importPlayStatus}
                  disabled={busyIdentity !== null}
                  onChange={(event) =>
                    setImportPlayStatus(event.target.value as PlayStatus)
                  }
                >
                  {playStatuses.map((status) => (
                    <option value={status} key={status}>
                      {playStatusLabels[status]}
                    </option>
                  ))}
                </select>
              </label>

              <button
                className="button button--quiet"
                type="button"
                disabled={busyIdentity !== null}
                onClick={() =>
                  onImportTitle(title, importPlatform, importPlayStatus)
                }
              >
                {busyIdentity === identity
                  ? "Creating and linking…"
                  : "Create from PSN"}
              </button>
            </div>
          </div>
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

  const [libraryGames, setLibraryGames] = useState<readonly LibraryGame[]>([]);

  const [selectedGameIds, setSelectedGameIds] = useState<
    Readonly<Record<string, string>>
  >({});

  const [activeFilter, setActiveFilter] = useState<PreviewFilter>("all");

  const [searchQuery, setSearchQuery] = useState("");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSynchronizing, setIsSynchronizing] = useState(false);
  const [lastSynchronization, setLastSynchronization] =
    useState<PlayStationSyncResult | null>(null);
  const [lastDetailSynchronization, setLastDetailSynchronization] =
    useState<PlayStationTrophyDetailSynchronizationResult | null>(null);
  const [busyIdentity, setBusyIdentity] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [notice, setNotice] = useState<string | null>(null);
  const { syncProgress, refreshSyncProgress } =
    usePlayStationSyncProgress(isSynchronizing);
  const synchronizationActive =
    isSynchronizing || syncProgress?.status === "running";

  useEffect(() => {
    const abortController = new AbortController();

    async function loadPageData() {
      try {
        const [loadedStatus, loadedGames] = await Promise.all([
          playStationApi.getStatus(abortController.signal),
          libraryApi.list(abortController.signal),
        ]);

        if (!abortController.signal.aborted) {
          setStatus(loadedStatus);
          setLibraryGames(loadedGames);
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          setErrorMessage(getErrorMessage(error));
        }
      }
    }

    void loadPageData();

    return () => abortController.abort();
  }, []);

  const visibleTitles = useMemo(() => {
    if (preview === null) {
      return [];
    }

    const normalizedQuery = searchQuery.trim().toLocaleLowerCase("en-US");

    return preview.titles.filter((title) => {
      if (!titleMatchesPreviewFilter(title, activeFilter)) {
        return false;
      }

      return (
        normalizedQuery.length === 0 ||
        title.name.toLocaleLowerCase("en-US").includes(normalizedQuery)
      );
    });
  }, [activeFilter, preview, searchQuery]);

  const linkedGameIds = useMemo(() => {
    if (preview === null) {
      return new Set<string>();
    }

    return new Set(
      preview.titles
        .filter((title) => title.reconciliation.status === "linked")
        .flatMap((title) =>
          title.reconciliation.candidates.map((candidate) => candidate.gameId),
        ),
    );
  }, [preview]);

  function availableCandidates(
    title: ReconciledPlayStationTitle,
  ): readonly PlayStationLibraryCandidate[] {
    return libraryGames
      .filter(
        (game) =>
          title.platforms.includes(game.platform) &&
          !linkedGameIds.has(game.id),
      )
      .map((game) => ({
        gameId: game.id,
        title: game.title,
        platform: game.platform,
        archived: game.hiddenAt !== null,
        metadataProvider: null,
        playStationLinkSource: null,
      }));
  }

  function selectCandidate(titleIdentity: string, gameId: string): void {
    setSelectedGameIds((currentSelections) => ({
      ...currentSelections,
      [titleIdentity]: gameId,
    }));
  }

  function storePreview(
    nextPreview: PlayStationTitlePreview,
    selectPreferredFilter = false,
  ): void {
    setPreview(nextPreview);

    setActiveFilter((currentFilter) => {
      const currentFilterStillHasTitles = nextPreview.titles.some((title) =>
        titleMatchesPreviewFilter(title, currentFilter),
      );

      if (selectPreferredFilter || !currentFilterStillHasTitles) {
        return choosePreferredPreviewFilter(nextPreview);
      }

      return currentFilter;
    });
  }

  function handleMetadataEnriched(
    title: ReconciledPlayStationTitle,
    candidate: PlayStationLibraryCandidate,
  ): void {
    if (preview === null) {
      return;
    }

    const updatedPreview: PlayStationTitlePreview = {
      ...preview,
      titles: preview.titles.map((existingTitle) => {
        if (
          existingTitle.npServiceName !== title.npServiceName ||
          existingTitle.npCommunicationId !== title.npCommunicationId
        ) {
          return existingTitle;
        }

        return {
          ...existingTitle,
          reconciliation: {
            ...existingTitle.reconciliation,
            candidates: existingTitle.reconciliation.candidates.map(
              (existingCandidate) =>
                existingCandidate.gameId === candidate.gameId
                  ? {
                      ...existingCandidate,
                      metadataProvider: "igdb",
                    }
                  : existingCandidate,
            ),
          },
        };
      }),
    };

    storePreview(updatedPreview);
    setNotice(`IGDB metadata was attached to ${candidate.title}.`);
  }

  async function handlePreview(): Promise<void> {
    setIsPreviewing(true);
    setErrorMessage(null);
    setNotice(null);

    try {
      const loadedPreview = await playStationApi.previewTitles();

      storePreview(loadedPreview, true);

      setNotice(
        `Read ${loadedPreview.supportedTitleCount} supported trophy titles using ${loadedPreview.requestsMade} PlayStation requests.`,
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleSynchronization(): Promise<void> {
    setIsSynchronizing(true);
    setErrorMessage(null);
    setNotice(null);

    try {
      const result = await playStationApi.synchronize();

      storePreview(result.preview, true);
      setLastSynchronization(result.synchronization);
      setLastDetailSynchronization(result.detailSynchronization);

      if (result.synchronization.status === "succeeded") {
        setNotice(
          `Synchronized ${result.synchronization.processedTitleCount} linked games and created ${result.synchronization.snapshotsCreated} trophy snapshots.`,
        );
      }
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === "playstation_sync_in_progress"
      ) {
        const progress = await refreshSyncProgress().catch(() => null);

        if (progress?.status === "running") {
          return;
        }
      }

      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSynchronizing(false);
    }
  }

  async function handleConfirmMatch(
    title: ReconciledPlayStationTitle,
    candidate: PlayStationLibraryCandidate,
  ): Promise<void> {
    const identity = `${title.npServiceName}:${title.npCommunicationId}`;

    setBusyIdentity(identity);
    setErrorMessage(null);
    setNotice(null);

    try {
      await playStationApi.linkTitle({
        gameId: candidate.gameId,
        npServiceName: title.npServiceName,
        npCommunicationId: title.npCommunicationId,
      });

      if (preview !== null) {
        storePreview(updateLinkedTitle(preview, title, candidate));
      }

      setSelectedGameIds((currentSelections) => {
        const nextSelections = { ...currentSelections };

        delete nextSelections[identity];

        return nextSelections;
      });

      setNotice(`${title.name} was linked to ${candidate.title}.`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyIdentity(null);
    }
  }

  async function handleImportTitle(
    title: ReconciledPlayStationTitle,
    platform: PlayStationPlatform,
    playStatus: PlayStatus,
  ): Promise<void> {
    const identity = `${title.npServiceName}:${title.npCommunicationId}`;

    setBusyIdentity(identity);
    setErrorMessage(null);
    setNotice(null);

    try {
      const result = await playStationApi.importTitle({
        npServiceName: title.npServiceName,
        npCommunicationId: title.npCommunicationId,
        platform,
        playStatus,
      });

      const candidate: PlayStationLibraryCandidate = {
        gameId: result.game.id,
        title: result.game.title,
        platform: result.game.platform,
        archived: false,
        metadataProvider: null,
        playStationLinkSource: "sync_created",
      };

      setLibraryGames((currentGames) => [...currentGames, result.game]);

      if (preview !== null) {
        storePreview(updateLinkedTitle(preview, title, candidate));
      }

      setSelectedGameIds((currentSelections) => {
        const nextSelections = { ...currentSelections };

        delete nextSelections[identity];

        return nextSelections;
      });

      setNotice(
        `${result.game.title} was created as a ${platform} library game and linked to its trophy stack.`,
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyIdentity(null);
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

        <div className="library-heading__actions">
          <button
            className="button button--quiet"
            type="button"
            disabled={
              status?.configured !== true ||
              isPreviewing ||
              synchronizationActive ||
              busyIdentity !== null
            }
            onClick={() => void handlePreview()}
          >
            {isPreviewing
              ? "Reading PlayStation titles…"
              : preview === null
                ? "Preview trophy library"
                : "Refresh preview"}
          </button>

          <button
            className="button button--primary"
            type="button"
            disabled={
              status?.configured !== true ||
              isPreviewing ||
              synchronizationActive ||
              busyIdentity !== null
            }
            onClick={() => void handleSynchronization()}
          >
            {synchronizationActive
              ? "Synchronizing linked games…"
              : "Synchronize linked games"}
          </button>
        </div>
      </div>

      <PlayStationSyncProgressPanel progress={syncProgress} />

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

      {lastSynchronization === null ? null : (
        <section
          className={`psn-sync-result${
            lastSynchronization.status === "partial"
              ? " psn-sync-result--partial"
              : ""
          }`}
          aria-labelledby="psn-sync-result-title"
        >
          <div className="psn-sync-result__heading">
            <div>
              <p className="eyebrow">Latest synchronization</p>

              <h3 id="psn-sync-result-title">
                {lastSynchronization.status === "succeeded"
                  ? "Linked games synchronized"
                  : "Synchronization completed partially"}
              </h3>
            </div>

            <span
              className={`psn-sync-status psn-sync-status--${lastSynchronization.status}`}
            >
              {lastSynchronization.status === "succeeded"
                ? "Succeeded"
                : "Partial"}
            </span>
          </div>

          <div className="psn-sync-result__counts">
            <div>
              <strong>{lastSynchronization.processedTitleCount}</strong>

              <span>
                of {lastSynchronization.expectedTitleCount} linked games
              </span>
            </div>

            <div>
              <strong>{lastSynchronization.snapshotsCreated}</strong>

              <span>Snapshots created</span>
            </div>

            <div>
              <strong>{lastSynchronization.newTrophyAlertsCreated}</strong>

              <span>Expanded trophy sets</span>
            </div>

            <div>
              <strong>{lastSynchronization.completionLostAlertsCreated}</strong>

              <span>Completion lost</span>
            </div>

            <div>
              <strong>{lastSynchronization.requestsMade}</strong>

              <span>PlayStation requests</span>
            </div>

            {lastDetailSynchronization === null ? null : (
              <div>
                <strong>
                  {lastDetailSynchronization.fullRefreshCount +
                    lastDetailSynchronization.earningsOnlyRefreshCount}
                </strong>

                <span>Detailed trophy updates</span>
              </div>
            )}
          </div>

          {lastSynchronization.status === "partial" ? (
            <p className="psn-sync-result__warning">
              Some linked trophy stacks were absent from Sony’s response. Their
              previous snapshots were preserved and no assumptions were made
              about their current state.
            </p>
          ) : null}

          <p className="psn-sync-result__time">
            {lastDetailSynchronization === null ? null : (
              <>
                {lastDetailSynchronization.unchangedCount} linked{" "}
                {lastDetailSynchronization.unchangedCount === 1
                  ? "game required"
                  : "games required"}{" "}
                no detailed requests.{" "}
              </>
            )}
            Finished{" "}
            {new Intl.DateTimeFormat(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(lastSynchronization.finishedAt))}
          </p>
        </section>
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
                  availableCandidates={availableCandidates(title)}
                  selectedCandidateId={
                    selectedGameIds[
                      `${title.npServiceName}:${title.npCommunicationId}`
                    ] ?? ""
                  }
                  busyIdentity={busyIdentity}
                  onMetadataEnriched={handleMetadataEnriched}
                  onSelectCandidate={selectCandidate}
                  onConfirmMatch={(selectedTitle, candidate) =>
                    void handleConfirmMatch(selectedTitle, candidate)
                  }
                  onImportTitle={(selectedTitle, platform, playStatus) =>
                    void handleImportTitle(selectedTitle, platform, playStatus)
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
