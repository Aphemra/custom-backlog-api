import type {
  GameResourceProvider,
  GameResourceType,
} from "../resources/gameResourceTypes.js";
import { PORTABLE_DATA_FORMAT } from "./portableDataTypes.js";
import type { PortableDataExportV4 } from "./portableDataV4Types.js";

export interface PortableGameResource {
  readonly id: string;
  readonly gameId: string;
  readonly resourceType: GameResourceType;
  readonly provider: GameResourceProvider;
  readonly url: string;
  readonly label: string | null;
  readonly sortOrder: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PortableDataExportV5 {
  readonly format: typeof PORTABLE_DATA_FORMAT;
  readonly formatVersion: 5;
  readonly exportedAt: string;

  readonly data: PortableDataExportV4["data"] & {
    readonly gameResources: readonly PortableGameResource[];
  };
}
