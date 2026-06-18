import { useState, type SyntheticEvent } from "react";
import type { GameEntry } from "../../../domain/backlog";
import type { TrophySyncPreview } from "../types/trophySyncPreview";
import { createManualTrophySyncPreview } from "../services/createManualTrophySyncPreview";
import { useBacklogStore } from "../store/useBacklogStore";

interface TrophySyncPreviewPanelProps {
  game: GameEntry;
}

export function TrophySyncPreviewPanel({ game }: TrophySyncPreviewPanelProps) {
  const updateGameEntry = useBacklogStore((state) => state.updateGameEntry);

  const [psnProfilesUrl, setPsnProfilesUrl] = useState(game.trophyProgress.psnProfilesUrl ?? "");
  const [earnedTrophies, setEarnedTrophies] = useState((game.trophyProgress.earnedTrophies ?? 0).toString());
  const [totalTrophies, setTotalTrophies] = useState((game.trophyProgress.totalTrophies ?? 0).toString());
  const [preview, setPreview] = useState<TrophySyncPreview | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);

  function handlePreview(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedEarnedTrophies = parseNonNegativeInteger(earnedTrophies);
    const parsedTotalTrophies = parseNonNegativeInteger(totalTrophies);

    if (parsedEarnedTrophies === null || parsedTotalTrophies === null) {
      setPreview(null);
      setApplyMessage(null);
      setErrorMessage("Trophy counts must be whole numbers at or above zero.");
      return;
    }

    const nextPreview = createManualTrophySyncPreview(game, {
      psnProfilesUrl,
      earnedTrophies: parsedEarnedTrophies,
      totalTrophies: parsedTotalTrophies,
    });

    setPreview(nextPreview);
    setErrorMessage(null);
    setApplyMessage(null);
  }

  function handleApplyPreview() {
    if (!preview || preview.warnings.length > 0) {
      return;
    }

    updateGameEntry(game.id, {
      trophyProgress: {
        ...game.trophyProgress,
        completionPercent: calculateCompletePercent(preview.nextData.earnedTrophies, preview.nextData.totalTrophies),
        earnedTrophies: preview.nextData.earnedTrophies,
        totalTrophies: preview.nextData.totalTrophies,
        psnProfilesUrl: preview.nextData.psnProfilesUrl,
        lastSyncedAt: new Date().toISOString(),
      },
    });

    setApplyMessage("Trophy preview applied.");
    setPreview(null);
  }

  return (
    <section className="details-section trophy-sync-preview-panel">
      <div>
        <h3>PSNProfiles Sync Preview</h3>
        <p className="helper-text">Manually enter trophy progress from PSNProfiles, preview the changes, then apply them to this backlog entry.</p>
      </div>

      <form className="trophy-sync-preview-form" onSubmit={handlePreview}>
        <label className="form-field">
          <span>PSNProfiles trophy page URL</span>
          <input
            type="url"
            value={psnProfilesUrl}
            placeholder="https://psnprofiles.com/trophies/..."
            onChange={(event) => setPsnProfilesUrl(event.target.value)}
          />
        </label>

        <div className="trophy-sync-preview-grid">
          <label className="form-field">
            <span>Earned trophies</span>
            <input type="number" min="0" step="1" value={earnedTrophies} onChange={(event) => setEarnedTrophies(event.target.value)} />
          </label>

          <label className="form-field">
            <span>Total trophies</span>
            <input type="number" min="0" step="1" value={totalTrophies} onChange={(event) => setTotalTrophies(event.target.value)} />
          </label>
        </div>

        <button className="button" type="submit">
          Preview Sync
        </button>
      </form>

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
      {applyMessage ? <p className="helper-text">{applyMessage}</p> : null}

      {preview ? (
        <div className="sync-preview-card">
          <h4>Preview</h4>

          {preview.warnings.length > 0 ? (
            <div className="sync-preview-warning">
              <strong>Fix before applying:</strong>
              <ul>
                {preview.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {preview.hasChanges ? (
            <ul className="sync-preview-list">
              {preview.changes.map((change) => (
                <li key={change.field}>
                  <span>{change.label}</span>
                  <strong>
                    {change.currentValue} → {change.nextValue}
                  </strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="helper-text">No changes detected.</p>
          )}

          <button
            className="button button--primary"
            type="button"
            disabled={!preview.hasChanges || preview.warnings.length > 0}
            onClick={handleApplyPreview}
          >
            Apply Preview
          </button>
        </div>
      ) : null}
    </section>
  );
}

function parseNonNegativeInteger(value: string): number | null {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    return null;
  }

  return parsedValue;
}

function calculateCompletePercent(earnedTrophies: number, totalTrophies: number) {
  if (totalTrophies <= 0) {
    return 0;
  }

  return Math.round((earnedTrophies / totalTrophies) * 100);
}
