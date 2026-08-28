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

export interface PortableImportResult extends PortableImportPreview {
  readonly importedAt: string;

  readonly backup: {
    readonly fileName: string;
    readonly createdAt: string;
  };
}

export const deleteEntireBacklogConfirmation = "Delete Entire Backlog";

export interface BacklogDeletionResult {
  readonly deletedAt: string;

  readonly deleted: {
    readonly libraryGames: number;
    readonly collections: number;
    readonly savedViews: number;
  };

  readonly backup: {
    readonly fileName: string;
    readonly createdAt: string;
  };
}
