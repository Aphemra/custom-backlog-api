import { useRef } from "react";
import { createBacklogBackup } from "../../importExport/services/createBacklogBackup";
import { downloadJsonFile } from "../../importExport/services/downloadJsonFile";
import { readJsonFile } from "../../importExport/services/readJsonFile";
import { validateBacklogBackup } from "../../importExport/services/validateBacklogBackup";
import type { BacklogStatusFilter } from "../types/backlogFilters";
import { useBacklogStore } from "../store/useBacklogStore";

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

export function BacklogControls() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const user = useBacklogStore((state) => state.user);
  const backlog = useBacklogStore((state) => state.backlog);
  const gameEntries = useBacklogStore((state) => state.gameEntries);
  const buckets = useBacklogStore((state) => state.buckets);

  const filters = useBacklogStore((state) => state.filters);
  const setSearchText = useBacklogStore((state) => state.setSearchText);
  const setStatusFilter = useBacklogStore((state) => state.setStatusFilter);
  const clearFilters = useBacklogStore((state) => state.clearFilters);

  const replaceBacklogData = useBacklogStore((state) => state.replaceBacklogData);
  const resetBacklogData = useBacklogStore((state) => state.resetBacklogData);

  const hasActiveFilters = filters.searchText.trim().length > 0 || filters.statusFilter !== "all";

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

    try {
      const jsonData = await readJsonFile(selectedFile);
      const backup = validateBacklogBackup(jsonData);

      const shouldImport = window.confirm(`Import backup from ${backup.exportedAt}? This will replace your current local backlog data.`);

      if (shouldImport) {
        replaceBacklogData(backup);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong while importing the backup.";

      window.alert(message);
    } finally {
      event.target.value = "";
    }
  }

  function handleResetClick() {
    const shouldReset = window.confirm("Reset the local backlog data back to the mock seed data?");

    if (shouldReset) {
      resetBacklogData();
    }
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

        <button className="button" type="button" onClick={clearFilters} disabled={!hasActiveFilters}>
          Clear
        </button>
      </div>

      <input ref={fileInputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={handleImportFileChange} />

      <div className="control-buttons">
        <button className="button" type="button">
          Buckets
        </button>

        <button className="button" type="button" onClick={handleExportClick}>
          Export
        </button>

        <button className="button" type="button" onClick={handleImportClick}>
          Import
        </button>

        <button className="button" type="button">
          Update
        </button>

        <button className="button" type="button" onClick={handleResetClick}>
          Reset
        </button>
      </div>
    </section>
  );
}
