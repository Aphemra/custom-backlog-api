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

export interface PortableImportResult extends PortableImportPreview {
  readonly importedAt: string;

  readonly backup: {
    readonly fileName: string;
    readonly createdAt: string;
  };
}
