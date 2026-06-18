import { useRef } from "react";
import { createBacklogBackup } from "../../importExport/services/createBacklogBackup";
import { downloadJsonFile } from "../../importExport/services/downloadJsonFile";
import { readJsonFile } from "../../importExport/services/readJsonFile";
import { validateBacklogBackup } from "../../importExport/services/validateBacklogBackup";
import type { BacklogRatingFilter, BacklogSortMode, BacklogStatusFilter } from "../types/backlogFilters";
import { useBacklogStore } from "../store/useBacklogStore";
import { confirmDestructiveAction } from "../services/confirmDestructiveAction";

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

  const hasActiveFilters =
    filters.searchText.trim().length > 0 ||
    filters.statusFilter !== "all" ||
    filters.ratingFilter !== "all" ||
    filters.bucketId !== null ||
    filters.sortMode !== "priority";

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

        <button className="button" type="button" disabled title="PlatPrices and PSNProfiles sync will be added next.">
          Update
        </button>

        <button className="button" type="button" onClick={handleResetClick}>
          Reset
        </button>
      </div>
    </section>
  );
}
