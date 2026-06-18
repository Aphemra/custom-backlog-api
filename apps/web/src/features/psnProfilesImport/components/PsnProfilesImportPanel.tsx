import { useMemo, useRef, useState, type ChangeEvent } from "react";
import type { GameEntry } from "../../../domain/backlog";
import { formatShortDateTime } from "../../../domain/date";
import { getPlatformShortName } from "../../../domain/display";
import { useBacklogStore } from "../../backlog/store/useBacklogStore";
import { normalizeTrophyProgress } from "../../backlog/services/trophyProgressHelpers";
import { parsePsnProfilesImportSourceText } from "../services/parsePsnProfilesImportSourceText";
import { matchPsnProfilesImportToBacklog } from "../services/matchPsnProfilesImportToBacklog";
import type { PsnProfilesBacklogMatch, PsnProfilesImportedGameProgress, PsnProfilesImportResult } from "../types/psnProfilesImport";

interface PsnProfilesImportPanelProps {
  initialImportResult?: PsnProfilesImportResult | null;
  onClose: () => void;
}

export function PsnProfilesImportPanel({ initialImportResult, onClose }: PsnProfilesImportPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const gameEntries = useBacklogStore((state) => state.gameEntries);
  const updateGameEntry = useBacklogStore((state) => state.updateGameEntry);

  const [sourceText, setSourceText] = useState("");
  const [importResult, setImportResult] = useState<PsnProfilesImportResult | null>(initialImportResult ?? null);
  const [selectedManualGameEntryIds, setSelectedManualGameEntryIds] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);

  const matches = useMemo(() => {
    if (!importResult) {
      return [];
    }

    return matchPsnProfilesImportToBacklog(importResult, gameEntries);
  }, [gameEntries, importResult]);

  const matchedCount = matches.filter((match) => match.gameEntryId !== undefined).length;
  const highConfidenceCount = matches.filter((match) => isHighConfidenceMatch(match.score)).length;
  const reviewCount = matches.filter((match) => isReviewMatch(match.score)).length;
  const unmatchedCount = matches.filter((match) => match.score === 0).length;

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    const fileText = await selectedFile.text();

    setSourceText(fileText);
    setImportResult(null);
    setSelectedManualGameEntryIds({});
    setApplyMessage(null);
    setErrorMessage(null);

    event.target.value = "";
  }

  function handleSourceTextChange(value: string) {
    setSourceText(value);
    setImportResult(null);
    setSelectedManualGameEntryIds({});
    setApplyMessage(null);
    setErrorMessage(null);
  }

  function handleParse() {
    try {
      const nextImportResult = parsePsnProfilesImportSourceText(sourceText);

      setImportResult(nextImportResult);
      setSelectedManualGameEntryIds({});
      setErrorMessage(null);
      setApplyMessage(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not parse the PSNProfiles import.";
      setImportResult(null);
      setSelectedManualGameEntryIds({});
      setApplyMessage(null);
      setErrorMessage(message);
    }
  }

  function handleApplyMatchedUpdates() {
    const applyableMatches = matches.filter((match) => match.gameEntryId !== undefined && isHighConfidenceMatch(match.score));
    let appliedCount = 0;

    for (const match of applyableMatches) {
      if (!match.gameEntryId) {
        continue;
      }

      const appliedTitle = applyImportedProgressToGameEntry(match.gameEntryId, match.importedGame);

      if (appliedTitle) {
        appliedCount += 1;
      }
    }

    setApplyMessage(`Applied ${appliedCount} high-confidence PSNProfiles update(s).`);
  }

  function handleManualMappingChange(matchKey: string, gameEntryId: string) {
    setSelectedManualGameEntryIds((currentSelections) => ({
      ...currentSelections,
      [matchKey]: gameEntryId,
    }));
  }

  function handleApplyManualMatch(match: PsnProfilesBacklogMatch, matchIndex: number) {
    const matchKey = getMatchKey(match, matchIndex);
    const selectedGameEntryId = getSelectedManualGameEntryId(match, matchKey);

    if (!selectedGameEntryId) {
      setErrorMessage("Choose a backlog entry before applying this manual PSNProfiles match.");
      return;
    }

    const appliedTitle = applyImportedProgressToGameEntry(selectedGameEntryId, match.importedGame);

    if (!appliedTitle) {
      setErrorMessage("The selected backlog entry could not be found.");
      return;
    }

    setErrorMessage(null);
    setApplyMessage(
      `Applied manual PSNProfiles mapping: ${match.importedGame.sourceTitle} → ${appliedTitle}. Future imports can use the saved PSNProfiles URL for an exact match.`,
    );
  }

  function applyImportedProgressToGameEntry(gameEntryId: string, importedGame: PsnProfilesImportedGameProgress): string | null {
    const gameEntry = gameEntries.find((entry) => entry.id === gameEntryId);

    if (!gameEntry) {
      return null;
    }

    updateGameEntry(gameEntry.id, {
      trophyProgress: normalizeTrophyProgress({
        ...gameEntry.trophyProgress,
        earnedTrophies: importedGame.earnedTrophies,
        totalTrophies: importedGame.totalTrophies,
        completionPercent: importedGame.completionPercent,
        ...(importedGame.sourceUrl ? { psnProfilesUrl: importedGame.sourceUrl } : {}),
        lastSyncedAt: new Date().toISOString(),
      }),
    });

    return gameEntry.title;
  }

  function getSelectedManualGameEntryId(match: PsnProfilesBacklogMatch, matchKey: string): string {
    return selectedManualGameEntryIds[matchKey] ?? match.gameEntryId ?? "";
  }

  return (
    <section className="psnp-import-panel">
      <div className="details-toolbar">
        <div>
          <h3>Import PSNProfiles Progress</h3>
          <p>
            Paste or upload PSNProfiles HTML/text or a userscript JSON export, preview matches, then apply high-confidence or manually reviewed
            updates.
          </p>
        </div>

        <div className="form-actions">
          <button className="button" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        {initialImportResult ? (
          <p className="helper-text">
            Loaded the latest local PSNProfiles userscript export. Review rows can be manually mapped below; saved PSNProfiles URLs should become
            exact matches on future updates.
          </p>
        ) : null}
      </div>

      <div className="form-actions">
        <input
          ref={fileInputRef}
          className="visually-hidden"
          type="file"
          accept=".html,.htm,.txt,.json,text/html,text/plain,application/json"
          onChange={handleFileChange}
        />

        <button className="button" type="button" onClick={() => fileInputRef.current?.click()}>
          Upload Saved Page
        </button>

        <button className="button button--primary" type="button" onClick={handleParse}>
          Parse Import
        </button>
      </div>

      <label className="field field--wide">
        <span>PSNProfiles HTML/text/JSON</span>
        <textarea
          rows={10}
          value={sourceText}
          placeholder="Paste saved PSNProfiles page HTML, copied page text, or userscript JSON export here..."
          onChange={(event) => handleSourceTextChange(event.target.value)}
        />
      </label>

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
      {applyMessage ? <p className="helper-text">{applyMessage}</p> : null}

      {importResult ? (
        <div className="psnp-import-results">
          <div className="details-grid">
            <DetailItem label="Source" value={importResult.sourceLabel} />
            <DetailItem label="Imported" value={formatShortDateTime(importResult.importedAt)} />
            <DetailItem label="Detected Games" value={importResult.games.length.toString()} />
            <DetailItem label="Matched Games" value={matchedCount.toString()} />
            <DetailItem label="High Confidence" value={highConfidenceCount.toString()} />
            <DetailItem label="Needs Review" value={reviewCount.toString()} />
            <DetailItem label="Unmatched" value={unmatchedCount.toString()} />
          </div>

          {importResult.warnings.length > 0 ? (
            <div className="sync-preview-warning">
              <strong>Warnings</strong>
              <ul>
                {importResult.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <button className="button button--primary" type="button" disabled={highConfidenceCount === 0} onClick={handleApplyMatchedUpdates}>
            Apply High-Confidence Matches
          </button>

          <div className="psnp-import-match-list">
            {matches.map((match, matchIndex) => {
              const matchKey = getMatchKey(match, matchIndex);
              const selectedManualGameEntryId = getSelectedManualGameEntryId(match, matchKey);
              const needsManualReview = !isHighConfidenceMatch(match.score);

              return (
                <article className="psnp-import-match-item" key={matchKey}>
                  <div>
                    <strong>{match.importedGame.sourceTitle}</strong>
                    <p className="helper-text">
                      {match.importedGame.earnedTrophies}/{match.importedGame.totalTrophies} trophies • {match.importedGame.completionPercent}%
                      {match.importedGame.platformText ? ` • ${match.importedGame.platformText}` : ""}
                      {match.importedGame.rawPlatformText && match.importedGame.rawPlatformText !== match.importedGame.platformText
                        ? ` (${match.importedGame.rawPlatformText})`
                        : ""}
                    </p>
                  </div>

                  <div className="psnp-import-match-status">
                    <span className={`match-pill ${getMatchPillClassName(match.score)}`}>{getMatchLabel(match.score)}</span>
                    <p className="helper-text">{match.reason}</p>
                  </div>

                  {needsManualReview ? (
                    <div className="psnp-import-manual-review">
                      <label className="field psnp-import-manual-review__field">
                        <span>Manual backlog match</span>
                        <select value={selectedManualGameEntryId} onChange={(event) => handleManualMappingChange(matchKey, event.target.value)}>
                          <option value="">Choose backlog entry...</option>
                          {gameEntries.map((gameEntry) => (
                            <option value={gameEntry.id} key={gameEntry.id}>
                              {formatGameEntryOptionLabel(gameEntry)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <button
                        className="button"
                        type="button"
                        disabled={!selectedManualGameEntryId}
                        onClick={() => handleApplyManualMatch(match, matchIndex)}
                      >
                        Apply Selected Mapping
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-item">
      <span className="detail-item__label">{label}</span>
      <span className="detail-item__value">{value}</span>
    </div>
  );
}

function isHighConfidenceMatch(score: number): boolean {
  return score >= 95;
}

function isReviewMatch(score: number): boolean {
  return score > 0 && score < 95;
}

function getMatchLabel(score: number): string {
  if (isHighConfidenceMatch(score)) {
    return `${score}% match`;
  }

  if (isReviewMatch(score)) {
    return `${score}% review`;
  }

  return "unmatched";
}

function getMatchPillClassName(score: number): string {
  if (isHighConfidenceMatch(score)) {
    return "match-pill--matched";
  }

  if (isReviewMatch(score)) {
    return "match-pill--review";
  }

  return "match-pill--unmatched";
}

function getMatchKey(match: PsnProfilesBacklogMatch, matchIndex: number): string {
  return (
    match.importedGame.sourceTrophyListId ??
    match.importedGame.sourceUrl ??
    `${matchIndex}-${match.importedGame.sourceTitle}-${match.importedGame.platformText ?? "unknown"}-${match.importedGame.totalTrophies}`
  );
}

function formatGameEntryOptionLabel(gameEntry: GameEntry): string {
  const platformLabels = gameEntry.platformIds.map(getPlatformShortName).join(" / ");

  return `#${gameEntry.priorityOrder} • ${gameEntry.title}${platformLabels ? ` • ${platformLabels}` : ""}`;
}
