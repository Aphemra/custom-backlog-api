import type {
  PlayStationPlatform,
  PursuitStatus,
} from "../library/libraryGameTypes.js";

export const PORTABLE_DATA_FORMAT = "trophy-backlog-portable-data";

export const PORTABLE_DATA_VERSION = 1;

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

export interface PortableDataExport {
  readonly format: typeof PORTABLE_DATA_FORMAT;
  readonly formatVersion: typeof PORTABLE_DATA_VERSION;
  readonly exportedAt: string;

  readonly data: {
    readonly libraryGames: readonly PortableLibraryGame[];

    readonly collections: readonly PortableCollection[];
  };
}

export interface PortableDataCounts {
  readonly libraryGames: number;
  readonly collections: number;
  readonly memberships: number;
}

export interface PortableImportPreview {
  readonly formatVersion: number;
  readonly exportedAt: string;
  readonly incoming: PortableDataCounts;
  readonly current: PortableDataCounts;
}
