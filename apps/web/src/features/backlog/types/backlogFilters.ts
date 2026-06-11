export type BacklogStatusFilter = "all" | "not_completed" | "in_progress" | "completed" | "hundred_percent_not_platinumed" | "hundred_percent";

export interface BacklogFilters {
  searchText: string;
  statusFilter: BacklogStatusFilter;
}
