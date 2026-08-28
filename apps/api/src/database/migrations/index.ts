import type { Migration } from "../migration.js";
import { initialSchemaMigration } from "./001InitialSchema.js";
import { integrationStorageMigration } from "./002IntegrationStorage.js";
import { playStatusFoundationMigration } from "./003PlayStatusFoundation.js";
import { savedViewPlayStatusMigration } from "./004SavedViewPlayStatus.js";
import { appSettingsDefaultsMigration } from "./005AppSettingsDefaults.js";
import { playStationProfileSnapshotsMigration } from "./006PlayStationProfileSnapshots.js";
import { playStationTrophyStorageMigration } from "./007PlayStationTrophyStorage.js";
import { playStationTrophyAccountScopeMigration } from "./008PlayStationTrophyAccountScope.js";
import { playStationTrophyAvailabilityMigration } from "./009PlayStationTrophyAvailability.js";
import { igdbGameDetailsMigration } from "./010IgdbGameDetails.js";
import { igdbMetadataImagesMigration } from "./011IgdbMetadataImages.js";
import { gameResourcesMigration } from "./012GameResources.js";

export const migrations: readonly Migration[] = [
  initialSchemaMigration,
  integrationStorageMigration,
  playStatusFoundationMigration,
  savedViewPlayStatusMigration,
  appSettingsDefaultsMigration,
  playStationProfileSnapshotsMigration,
  playStationTrophyStorageMigration,
  playStationTrophyAccountScopeMigration,
  playStationTrophyAvailabilityMigration,
  igdbGameDetailsMigration,
  igdbMetadataImagesMigration,
  gameResourcesMigration,
];
