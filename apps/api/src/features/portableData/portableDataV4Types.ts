import type {
  PlayStationPlatform,
  PlayStatus,
} from "../library/libraryGameTypes.js";
import type {
  PortableCollection,
  PortableSavedView,
} from "./portableDataTypes.js";
import { PORTABLE_DATA_FORMAT } from "./portableDataTypes.js";
import type {
  PortableCachedImage,
  PortableExternalGameMetadata,
  PortableGameMetadataLink,
  PortableLibraryGameImage,
  PortablePlayStationGameLink,
  PortableTrophyAlert,
  PortableTrophySnapshot,
} from "./portableDataV3Types.js";

export interface PortableLibraryGameV4 {
  readonly id: string;
  readonly title: string;
  readonly sortTitle: string;
  readonly platform: PlayStationPlatform;
  readonly playStatus: PlayStatus;
  readonly isUnobtainable: boolean;
  readonly priorityRank: number;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly hiddenAt: string | null;
}

export interface PortableDataExportV4 {
  readonly format: typeof PORTABLE_DATA_FORMAT;
  readonly formatVersion: 4;
  readonly exportedAt: string;

  readonly data: {
    readonly libraryGames: readonly PortableLibraryGameV4[];
    readonly collections: readonly PortableCollection[];
    readonly savedViews: readonly PortableSavedView[];
    readonly playstationGameLinks: readonly PortablePlayStationGameLink[];
    readonly externalGameMetadata: readonly PortableExternalGameMetadata[];
    readonly gameMetadataLinks: readonly PortableGameMetadataLink[];
    readonly trophySnapshots: readonly PortableTrophySnapshot[];
    readonly trophyAlerts: readonly PortableTrophyAlert[];
    readonly cachedImages: readonly PortableCachedImage[];
    readonly libraryGameImages: readonly PortableLibraryGameImage[];
  };
}
