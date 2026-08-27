import type {
  LibraryGameWithTrophySummary,
  PlayStationPlatform,
  PursuitStatus,
} from "./libraryGame";

export type ArchiveMode = "active" | "archived" | "all";

export type SavedViewSortField =
  | "priorityRank"
  | "title"
  | "platform"
  | "pursuitStatus"
  | "createdAt"
  | "updatedAt"
  | "progressPercent"
  | "lastSyncedAt"
  | "alertCreatedAt";

export type SortDirection = "asc" | "desc";

export interface SavedViewFilters {
  readonly search?: string;

  readonly platforms?: readonly PlayStationPlatform[];

  readonly pursuitStatuses?: readonly PursuitStatus[];

  readonly archiveMode?: ArchiveMode;

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

export interface SavedViewInput {
  readonly name: string;
  readonly filters: SavedViewFilters;
  readonly sort: SavedViewSort;
}

export interface SavedViewGames {
  readonly view: SavedView;
  readonly games: readonly LibraryGameWithTrophySummary[];
}

export const archiveModeLabels: Readonly<Record<ArchiveMode, string>> = {
  active: "Active games",
  archived: "Archived games",
  all: "Active and archived",
};

export const savedViewSortLabels: Readonly<Record<SavedViewSortField, string>> =
  {
    priorityRank: "Manual library order",
    title: "Title",
    platform: "Platform",
    pursuitStatus: "Pursuit status",
    createdAt: "Date added",
    updatedAt: "Last edited",
    progressPercent: "Trophy progress",
    lastSyncedAt: "Last trophy sync",
    alertCreatedAt: "Newest trophy alert",
  };
