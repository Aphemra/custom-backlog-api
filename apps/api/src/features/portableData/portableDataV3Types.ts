import type { PlayStationPlatform } from "../library/libraryGameTypes.js";
import type {
  PortableCollection,
  PortableLibraryGame,
  PortableSavedView,
} from "./portableDataTypes.js";
import { PORTABLE_DATA_FORMAT } from "./portableDataTypes.js";

export type PortableJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly PortableJsonValue[]
  | { readonly [key: string]: PortableJsonValue };

export interface PortablePlayStationGameLink {
  readonly gameId: string;
  readonly npCommunicationId: string;
  readonly npServiceName: "trophy" | "trophy2";
  readonly psnTitleName: string;
  readonly platforms: readonly PlayStationPlatform[];
  readonly iconUrl: string | null;
  readonly linkSource: "sync_created" | "automatic_match" | "manual_match";
  readonly payload: PortableJsonValue;
  readonly linkedAt: string;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
}

export interface PortableExternalGameMetadata {
  readonly id: string;
  readonly provider: string;
  readonly externalId: string;
  readonly title: string;
  readonly coverUrl: string | null;
  readonly releaseDate: string | null;
  readonly payload: PortableJsonValue;
  readonly fetchedAt: string;
}

export interface PortableGameMetadataLink {
  readonly gameId: string;
  readonly metadataId: string;
  readonly linkedAt: string;
}

export interface PortableTrophySnapshot {
  readonly id: string;
  readonly gameId: string;
  readonly capturedAt: string;
  readonly bronzeTotal: number;
  readonly silverTotal: number;
  readonly goldTotal: number;
  readonly platinumTotal: number;
  readonly bronzeEarned: number;
  readonly silverEarned: number;
  readonly goldEarned: number;
  readonly platinumEarned: number;
  readonly progressPercent: number;
  readonly is100Percent: boolean;
  readonly hasPlatinum: boolean;
  readonly payload: PortableJsonValue | null;
}

export interface PortableTrophyAlert {
  readonly id: string;
  readonly gameId: string;
  readonly kind: "new_trophies" | "completion_lost";
  readonly status: "unread" | "read" | "resolved" | "dismissed";
  readonly previousSnapshotId: string | null;
  readonly currentSnapshotId: string;
  readonly details: PortableJsonValue;
  readonly createdAt: string;
  readonly resolvedAt: string | null;
}

export interface PortableCachedImage {
  readonly id: string;
  readonly provider: "igdb" | "playstation";
  readonly sourceKey: string;
  readonly sourceUrl: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PortableLibraryGameImage {
  readonly gameId: string;
  readonly imageId: string;
  readonly role: "cover" | "icon" | "background";
  readonly sortOrder: number;
  readonly linkedAt: string;
}

export interface PortableDataExportV3 {
  readonly format: typeof PORTABLE_DATA_FORMAT;
  readonly formatVersion: 3;
  readonly exportedAt: string;

  readonly data: {
    readonly libraryGames: readonly PortableLibraryGame[];
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
