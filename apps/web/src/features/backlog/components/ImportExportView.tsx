import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { getLatestPsnProfilesImport } from "../../../services/api/psnProfilesImportApi";
import { createBacklogBackup } from "../../importExport/services/createBacklogBackup";
import { downloadJsonFile } from "../../importExport/services/downloadJsonFile";
import { readJsonFile } from "../../importExport/services/readJsonFile";
import { validateBacklogBackup } from "../../importExport/services/validateBacklogBackup";
import { PsnProfilesImportPanel } from "../../psnProfilesImport/components/PsnProfilesImportPanel";
import { matchPsnProfilesImportToBacklog } from "../../psnProfilesImport/services/matchPsnProfilesImportToBacklog";
import type { PsnProfilesImportResult } from "../../psnProfilesImport/types/psnProfilesImport";
import { normalizeTrophyProgress } from "../services/trophyProgressHelpers";
import { useBacklogStore } from "../store/useBacklogStore";
import { confirmDestructiveAction } from "../services/confirmDestructiveAction";

export function ImportExportView() {
  const backupFileInputRef = useRef<HTMLInputElement | null>(null);

  const user = useBacklogStore((state) => state.user);
  const backlog = useBacklogStore((state) => state.backlog);
  const gameEntries = useBacklogStore((state) => state.gameEntries);
  const buckets = useBacklogStore((state) => state.buckets);

  const replaceBacklogData = useBacklogStore((state) => state.replaceBacklogData);
  const updateGameEntry = useBacklogStore((state) => state.updateGameEntry);

  const [latestPsnProfilesSavedAt, setLatestPsnProfilesSavedAt] = useState<string | null>(null);
  const [isPsnProfilesUpdating, setIsPsnProfilesUpdating] = useState(false);
  const [psnProfilesImportResult, setPsnProfilesImportResult] = useState<PsnProfilesImportResult | null>(null);
  const [isPsnProfilesImportPanelOpen, setIsPsnProfilesImportPanelOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    void getLatestPsnProfilesImport()
      .then((latestImport) => {
        if (!isMounted) {
          return;
        }

        setLatestPsnProfilesSavedAt(latestImport.hasExport && latestImport.savedAt ? latestImport.savedAt : null);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setLatestPsnProfilesSavedAt(null);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function handleExportClick() {
    const backup = createBacklogBackup({
      user,
      backlog,
      gameEntries,
      buckets,
    });

    const dateStamp = new Date().toISOString().slice(0, 10);

    downloadJsonFile(`custom-backlog-backup-${dateStamp}.json`, backup);
  }

  function handleImportClick() {
    backupFileInputRef.current?.click();
  }

  async function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    const confirmed = confirmDestructiveAction({
      title: "Import backlog backup?",
      detail: "This will replace your current local backlog data with the selected backup file.",
      confirmationText: "IMPORT",
    });

    if (!confirmed) {
      event.target.value = "";
      return;
    }

    try {
      const jsonData = await readJsonFile(selectedFile);
      const backup = validateBacklogBackup(jsonData);

      replaceBacklogData(backup);
      setMessage("Backlog backup imported.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Something went wrong while importing the backup.";

      window.alert(errorMessage);
    } finally {
      event.target.value = "";
    }
  }

  async function handleUpdatePsnProfilesClick() {
    setIsPsnProfilesUpdating(true);
    setMessage(null);

    try {
      const latestImport = await getLatestPsnProfilesImport();

      if (!latestImport.hasExport || !latestImport.payload) {
        window.alert("No local PSNProfiles userscript export was found. Open PSNProfiles, click Export Backlog, then try Update again.");
        return;
      }

      const importResult: PsnProfilesImportResult = {
        importedAt: latestImport.payload.exportedAt,
        sourceLabel: `PSNProfiles userscript export: ${latestImport.payload.psnId}`,
        games: latestImport.payload.games,
        warnings: latestImport.payload.warnings ?? [],
      };

      const matches = matchPsnProfilesImportToBacklog(importResult, gameEntries);
      const highConfidenceMatches = matches.filter((match) => match.gameEntryId !== undefined && match.score >= 95);
      let appliedCount = 0;

      for (const match of highConfidenceMatches) {
        if (!match.gameEntryId) {
          continue;
        }

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

        appliedCount += 1;
      }

      const manualReviewCount = matches.length - appliedCount;

      setLatestPsnProfilesSavedAt(latestImport.savedAt ?? null);
      setPsnProfilesImportResult(importResult);

      if (manualReviewCount > 0) {
        setIsPsnProfilesImportPanelOpen(true);
      }

      setMessage(
        `Applied ${appliedCount} high-confidence PSNProfiles update(s). ${
          manualReviewCount > 0
            ? `${manualReviewCount} imported row(s) are ready for manual review below.`
            : "No imported rows were left for manual review."
        }`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Could not apply the latest PSNProfiles export.";

      window.alert(errorMessage);
    } finally {
      setIsPsnProfilesUpdating(false);
    }
  }

  return (
    <section className="import-export-view workspace-view-stack">
      <section className="details-section">
        <h3>Backup Data</h3>
        <p>Export or restore your local backlog data.</p>

        <input ref={backupFileInputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={handleImportFileChange} />

        <div className="form-actions import-export-view__actions">
          <button className="button" type="button" onClick={handleExportClick}>
            Export Backup
          </button>

          <button className="button" type="button" onClick={handleImportClick}>
            Import Backup
          </button>
        </div>
      </section>

      <section className="details-section">
        <h3>PSNProfiles Sync</h3>
        <p>
          Update trophy progress from the latest local PSNProfiles userscript export.
          {latestPsnProfilesSavedAt
            ? ` Latest export saved ${formatRelativeAge(latestPsnProfilesSavedAt)} ago.`
            : " No local export has been detected yet."}
        </p>

        <div className="form-actions import-export-view__actions">
          <button
            className="button button--primary"
            type="button"
            disabled={isPsnProfilesUpdating}
            onClick={() => void handleUpdatePsnProfilesClick()}
          >
            {isPsnProfilesUpdating ? "Updating..." : "Update from Latest PSNP Export"}
          </button>

          <button className="button" type="button" onClick={() => setIsPsnProfilesImportPanelOpen((currentValue) => !currentValue)}>
            {isPsnProfilesImportPanelOpen ? "Hide Manual Import" : "Open Manual Import / Review"}
          </button>
        </div>
      </section>

      {message ? <p className="helper-text">{message}</p> : null}

      {isPsnProfilesImportPanelOpen ? (
        <PsnProfilesImportPanel
          key={psnProfilesImportResult?.importedAt ?? "manual-psnprofiles-import"}
          initialImportResult={psnProfilesImportResult}
          onClose={() => {
            setIsPsnProfilesImportPanelOpen(false);
            setPsnProfilesImportResult(null);
          }}
        />
      ) : null}
    </section>
  );
}

function formatRelativeAge(value: string): string {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return "unknown";
  }

  const ageMs = Math.max(0, Date.now() - timestamp);
  const ageMinutes = Math.floor(ageMs / 60_000);

  if (ageMinutes < 1) {
    return "just now";
  }

  if (ageMinutes < 60) {
    return `${ageMinutes}m`;
  }

  const ageHours = Math.floor(ageMinutes / 60);

  if (ageHours < 24) {
    return `${ageHours}h`;
  }

  const ageDays = Math.floor(ageHours / 24);

  return `${ageDays}d`;
}
