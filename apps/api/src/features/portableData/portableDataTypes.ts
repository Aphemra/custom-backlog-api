import type {
  PlayStationPlatform,
  PursuitStatus,
} from "../library/libraryGameTypes.js";
import type {
  SavedViewFilters,
  SavedViewSort,
} from "../savedViews/savedViewTypes.js";
import type { PortableDataExportV3 } from "./portableDataV3Types.js";
import type { PortableDataExportV4 } from "./portableDataV4Types.js";
import type { PortableDataExportV5 } from "./portableDataV5Types.js";

export const PORTABLE_DATA_FORMAT = "trophy-backlog-portable-data";

export const PORTABLE_DATA_VERSION = 5;

export interface PortableLibraryGame {
  readonly id: string;
  readonly title: string;
  readonly sortTitle: string;
  readonly platform: PlayStationPlatform;
  readonly pursuitStatus: PursuitStatus;
  readonly priorityRank: number;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly archivedAt: string | null;
}

export interface PortableCollection {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly sortOrder: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly orderedGameIds: readonly string[];
}

export interface PortableSavedView {
  readonly id: string;
  readonly builtinKey: string | null;
  readonly name: string;
  readonly filters: SavedViewFilters;
  readonly sort: SavedViewSort;
  readonly sortOrder: number;
  readonly isBuiltin: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface PortableDataBase {
  readonly format: typeof PORTABLE_DATA_FORMAT;
  readonly exportedAt: string;
}

export interface PortableDataExportV1 extends PortableDataBase {
  readonly formatVersion: 1;

  readonly data: {
    readonly libraryGames: readonly PortableLibraryGame[];
    readonly collections: readonly PortableCollection[];
  };
}

export interface PortableDataExportV2 extends PortableDataBase {
  readonly formatVersion: 2;

  readonly data: {
    readonly libraryGames: readonly PortableLibraryGame[];
    readonly collections: readonly PortableCollection[];
    readonly savedViews: readonly PortableSavedView[];
  };
}

export type PortableDataExport =
  | PortableDataExportV1
  | PortableDataExportV2
  | PortableDataExportV3
  | PortableDataExportV4
  | PortableDataExportV5;

export interface PortableDataCounts {
  readonly libraryGames: number;
  readonly collections: number;
  readonly memberships: number;
  readonly savedViews: number;
  readonly playstationLinks: number;
  readonly metadataEntries: number;
  readonly trophySnapshots: number;
  readonly trophyAlerts: number;
  readonly cachedImages: number;
  readonly gameResources: number;
}

export interface PortableImportPreview {
  readonly formatVersion: number;
  readonly exportedAt: string;
  readonly incoming: PortableDataCounts;
  readonly current: PortableDataCounts;
}
