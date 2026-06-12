export type BacklogStatusFilter = "all" | "not_completed" | "in_progress" | "completed" | "hundred_percent_not_platinumed" | "hundred_percent";

export type BacklogRatingFilter = "all" | "rated" | "unrated";

export type BacklogSortMode = "priority" | "title_az" | "rating_high_to_low" | "rating_low_to_high";

export interface BacklogFilters {
  searchText: string;
  statusFilter: BacklogStatusFilter;
  ratingFilter: BacklogRatingFilter;
  bucketId: string | null;
  sortMode: BacklogSortMode;
}
