import { useEffect, useRef, useState } from "react";
import { createBacklogBackup } from "../../importExport/services/createBacklogBackup";
import { downloadJsonFile } from "../../importExport/services/downloadJsonFile";
import { readJsonFile } from "../../importExport/services/readJsonFile";
import { validateBacklogBackup } from "../../importExport/services/validateBacklogBackup";
import type { BacklogRatingFilter, BacklogSortMode, BacklogStatusFilter } from "../types/backlogFilters";
import { useBacklogStore } from "../store/useBacklogStore";
import { confirmDestructiveAction } from "../services/confirmDestructiveAction";
import { getLatestPsnProfilesImport } from "../../../services/api/psnProfilesImportApi";
import { normalizeTrophyProgress } from "../services/trophyProgressHelpers";
import { matchPsnProfilesImportToBacklog } from "../../psnProfilesImport/services/matchPsnProfilesImportToBacklog";
import type { PsnProfilesImportResult } from "../../psnProfilesImport/types/psnProfilesImport";

const statusFilterOptions: {
  value: BacklogStatusFilter;
  label: string;
}[] = [
  { value: "all", label: "All Games" },
  { value: "not_completed", label: "Not Completed" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "hundred_percent_not_platinumed", label: "100% But Not Platinumed" },
  { value: "hundred_percent", label: "100% Complete" },
];

const ratingFilterOptions: {
  value: BacklogRatingFilter;
  label: string;
}[] = [
  { value: "all", label: "All Ratings" },
  { value: "rated", label: "Rated Only" },
  { value: "unrated", label: "Unrated Only" },
];

const sortModeOptions: {
  value: BacklogSortMode;
  label: string;
}[] = [
  { value: "priority", label: "Priority Order" },
  { value: "title_az", label: "Title A-Z" },
  { value: "rating_high_to_low", label: "Rating High-Low" },
  { value: "rating_low_to_high", label: "Rating Low-High" },
];

export function BacklogControls() {
  const [latestPsnProfilesSavedAt, setLatestPsnProfilesSavedAt] = useState<string | null>(null);
  const [isPsnProfilesUpdating, setIsPsnProfilesUpdating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const user = useBacklogStore((state) => state.user);
  const backlog = useBacklogStore((state) => state.backlog);
  const gameEntries = useBacklogStore((state) => state.gameEntries);
  const buckets = useBacklogStore((state) => state.buckets);

  const filters = useBacklogStore((state) => state.filters);
  const setSearchText = useBacklogStore((state) => state.setSearchText);
  const setStatusFilter = useBacklogStore((state) => state.setStatusFilter);
  const setRatingFilter = useBacklogStore((state) => state.setRatingFilter);
  const setSortMode = useBacklogStore((state) => state.setSortMode);
  const clearFilters = useBacklogStore((state) => state.clearFilters);

  const replaceBacklogData = useBacklogStore((state) => state.replaceBacklogData);
  const resetBacklogData = useBacklogStore((state) => state.resetBacklogData);

  const isBucketPanelOpen = useBacklogStore((state) => state.isBucketPanelOpen);
  const toggleBucketPanel = useBacklogStore((state) => state.toggleBucketPanel);

  const isPsnProfilesImportPanelOpen = useBacklogStore((state) => state.isPsnProfilesImportPanelOpen);
  const togglePsnProfilesImportPanel = useBacklogStore((state) => state.togglePsnProfilesImportPanel);
  const openPsnProfilesImportPanel = useBacklogStore((state) => state.openPsnProfilesImportPanel);

  const updateGameEntry = useBacklogStore((state) => state.updateGameEntry);

  const hasActiveFilters =
    filters.searchText.trim().length > 0 ||
    filters.statusFilter !== "all" ||
    filters.ratingFilter !== "all" ||
    filters.bucketId !== null ||
    filters.sortMode !== "priority";

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

  async function handleUpdateClick() {
    setIsPsnProfilesUpdating(true);

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
      const applyableMatches = matches.filter((match) => match.gameEntryId !== undefined && match.score >= 95);

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

      setLatestPsnProfilesSavedAt(latestImport.savedAt ?? null);

      const manualReviewCount = matches.length - applyableMatches.length;

      if (manualReviewCount > 0) {
        openPsnProfilesImportPanel(importResult);
        return;
      }

      window.alert(`Applied ${applyableMatches.length} high-confidence PSNProfiles update(s). No imported rows were left for manual review.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not apply the latest PSNProfiles export.";

      window.alert(message);
    } finally {
      setIsPsnProfilesUpdating(false);
    }
  }

  function getUpdateButtonTitle(): string {
    if (!latestPsnProfilesSavedAt) {
      return "No local PSNProfiles userscript export found yet.";
    }

    return `Latest PSNProfiles export saved ${formatRelativeAge(latestPsnProfilesSavedAt)} ago.`;
  }

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
    fileInputRef.current?.click();
  }

  async function handleImportFileChange(event: React.ChangeEvent<HTMLInputElement>) {
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
      return;
    }

    try {
      const jsonData = await readJsonFile(selectedFile);
      const backup = validateBacklogBackup(jsonData);

      replaceBacklogData(backup);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong while importing the backup.";

      window.alert(message);
    } finally {
      event.target.value = "";
    }
  }

  function handleResetClick() {
    const confirmed = confirmDestructiveAction({
      title: "Reset backlog data?",
      detail: "This will replace your current local backlog with the default mock data.",
      confirmationText: "RESET",
    });

    if (!confirmed) {
      return;
    }

    resetBacklogData();
  }

  return (
    <section className="backlog-controls" aria-label="Backlog controls">
      <div className="filter-row">
        <input
          className="search-input"
          type="search"
          placeholder="Search backlog..."
          aria-label="Search backlog"
          value={filters.searchText}
          onChange={(event) => setSearchText(event.target.value)}
        />

        <select
          className="filter-select"
          aria-label="Filter backlog by status"
          value={filters.statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as BacklogStatusFilter)}
        >
          {statusFilterOptions.map((option) => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          className="filter-select"
          aria-label="Filter backlog by rating"
          value={filters.ratingFilter}
          onChange={(event) => setRatingFilter(event.target.value as BacklogRatingFilter)}
        >
          {ratingFilterOptions.map((option) => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          className="filter-select"
          aria-label="Sort backlog"
          value={filters.sortMode}
          onChange={(event) => setSortMode(event.target.value as BacklogSortMode)}
        >
          {sortModeOptions.map((option) => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button className="button" type="button" onClick={clearFilters} disabled={!hasActiveFilters}>
          Clear
        </button>
      </div>

      <input ref={fileInputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={handleImportFileChange} />

      <div className="control-buttons">
        <button className={`button ${isBucketPanelOpen ? "button--active" : ""}`} type="button" onClick={toggleBucketPanel}>
          Buckets
        </button>

        <button className="button" type="button" onClick={handleExportClick}>
          Export
        </button>

        <button className="button" type="button" onClick={handleImportClick}>
          Import
        </button>

        <button className={`button ${isPsnProfilesImportPanelOpen ? "button--active" : ""}`} type="button" onClick={togglePsnProfilesImportPanel}>
          Import PSNProfile
        </button>

        <button
          className="button"
          type="button"
          disabled={isPsnProfilesUpdating}
          title={getUpdateButtonTitle()}
          onClick={() => void handleUpdateClick()}
        >
          {isPsnProfilesUpdating
            ? "Updating..."
            : latestPsnProfilesSavedAt
              ? `Update PSNP (${formatRelativeAge(latestPsnProfilesSavedAt)})`
              : "Update PSNP"}
        </button>

        <button className="button" type="button" onClick={handleResetClick}>
          Reset
        </button>
      </div>
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
