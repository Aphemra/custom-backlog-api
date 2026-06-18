import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { formatShortDateTime } from "../../../domain/date";
import { useBacklogStore } from "../../backlog/store/useBacklogStore";
import { normalizeTrophyProgress } from "../../backlog/services/trophyProgressHelpers";
import { parsePsnProfilesImportSourceText } from "../services/parsePsnProfilesImportSourceText";
import { matchPsnProfilesImportToBacklog } from "../services/matchPsnProfilesImportToBacklog";
import type { PsnProfilesImportResult } from "../types/psnProfilesImport";

interface PsnProfilesImportPanelProps {
  onClose: () => void;
}

export function PsnProfilesImportPanel({ onClose }: PsnProfilesImportPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const gameEntries = useBacklogStore((state) => state.gameEntries);
  const updateGameEntry = useBacklogStore((state) => state.updateGameEntry);

  const [sourceText, setSourceText] = useState("");
  const [importResult, setImportResult] = useState<PsnProfilesImportResult | null>(null);
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

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    const fileText = await selectedFile.text();

    setSourceText(fileText);
    setImportResult(null);
    setApplyMessage(null);
    setErrorMessage(null);

    event.target.value = "";
  }

  function handleParse() {
    try {
      const nextImportResult = parsePsnProfilesImportSourceText(sourceText);

      setImportResult(nextImportResult);
      setErrorMessage(null);
      setApplyMessage(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not parse the PSNProfiles import.";
      setImportResult(null);
      setApplyMessage(null);
      setErrorMessage(message);
    }
  }

  function handleApplyMatchedUpdates() {
    const applyableMatches = matches.filter((match) => match.gameEntryId !== undefined && isHighConfidenceMatch(match.score));

    for (const match of applyableMatches) {
      const gameEntry = gameEntries.find((entry) => entry.id === match.gameEntryId);

      if (!gameEntry) {
        continue;
      }

      updateGameEntry(gameEntry.id, {
        trophyProgress: normalizeTrophyProgress({
          ...gameEntry.trophyProgress,
          earnedTrophies: match.importedGame.earnedTrophies,
          totalTrophies: match.importedGame.totalTrophies,
          completionPercent: match.importedGame.completionPercent,
          ...(match.importedGame.sourceUrl ? { psnProfilesUrl: match.importedGame.sourceUrl } : {}),
          lastSyncedAt: new Date().toISOString(),
        }),
      });
    }

    setApplyMessage(`Applied ${applyableMatches.length} high-confidence PSNProfiles update(s).`);
  }

  return (
    <section className="psnp-import-panel">
      <div className="details-toolbar">
        <div>
          <h3>Import PSNProfiles Progress</h3>
          <p>Paste or upload PSNProfiles HTML/text or a userscript JSON export, preview matches, then apply high-confidence updates.</p>
        </div>

        <div className="form-actions">
          <button className="button" type="button" onClick={onClose}>
            Close
          </button>
        </div>
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
          onChange={(event) => {
            setSourceText(event.target.value);
            setImportResult(null);
            setApplyMessage(null);
            setErrorMessage(null);
          }}
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
            {matches.map((match) => (
              <article
                className="psnp-import-match-item"
                key={
                  match.importedGame.sourceTrophyListId ??
                  match.importedGame.sourceUrl ??
                  `${match.importedGame.sourceTitle}-${match.importedGame.platformText ?? "unknown"}-${match.importedGame.totalTrophies}`
                }
              >
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

                <div>
                  <span className={`match-pill ${getMatchPillClassName(match.score)}`}>{getMatchLabel(match.score)}</span>
                  <p className="helper-text">{match.reason}</p>
                </div>
              </article>
            ))}
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
