import type {
  PlayStationPlatform,
  PlayStatus,
} from "../library/libraryGameTypes.js";

export const hiddenModes = ["visible", "hidden", "all"] as const;

export type HiddenMode = (typeof hiddenModes)[number];

export const savedViewSortFields = [
  "priorityRank",
  "title",
  "platform",
  "playStatus",
  "createdAt",
  "updatedAt",
  "progressPercent",
  "lastSyncedAt",
  "alertCreatedAt",
] as const;

export type SavedViewSortField = (typeof savedViewSortFields)[number];

export type SortDirection = "asc" | "desc";

export interface SavedViewFilters {
  readonly search?: string;
  readonly platforms?: readonly PlayStationPlatform[];
  readonly playStatuses?: readonly PlayStatus[];
  readonly hiddenMode?: HiddenMode;
  readonly collectionIds?: readonly string[];
  readonly platinumEarned?: boolean;
  readonly is100Percent?: boolean;
  readonly needsSync?: boolean;
  readonly alertKinds?: readonly ("new_trophies" | "completion_lost")[];
  readonly alertStatus?: "unread" | "read" | "resolved" | "dismissed";
}

export interface SavedViewSort {
  readonly field: SavedViewSortField;
  readonly direction: SortDirection;
}

export interface SavedView {
  readonly id: string;
  readonly builtinKey: string | null;
  readonly name: string;
  readonly filters: SavedViewFilters;
  readonly sort: SavedViewSort;
  readonly sortOrder: number;
  readonly isBuiltin: boolean;
  readonly isAvailable: boolean;
  readonly unavailableReason: "requires_trophy_data" | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateSavedViewInput {
  readonly name: string;
  readonly filters: SavedViewFilters;
  readonly sort: SavedViewSort;
}

export interface UpdateSavedViewInput {
  readonly name?: string;
  readonly filters?: SavedViewFilters;
  readonly sort?: SavedViewSort;
}
