import type { BacklogRatingFilter, BacklogSortMode, BacklogStatusFilter } from "../types/backlogFilters";
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
  const filters = useBacklogStore((state) => state.filters);
  const setSearchText = useBacklogStore((state) => state.setSearchText);
  const setStatusFilter = useBacklogStore((state) => state.setStatusFilter);
  const setRatingFilter = useBacklogStore((state) => state.setRatingFilter);
  const setSortMode = useBacklogStore((state) => state.setSortMode);
  const clearFilters = useBacklogStore((state) => state.clearFilters);

  const hasActiveFilters =
    filters.searchText.trim().length > 0 ||
    filters.statusFilter !== "all" ||
    filters.ratingFilter !== "all" ||
    filters.bucketId !== null ||
    filters.sortMode !== "priority";

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
    </section>
  );
}
