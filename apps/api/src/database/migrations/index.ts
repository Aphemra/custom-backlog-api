import type { Migration } from "../migration.js";
import { initialSchemaMigration } from "./001InitialSchema.js";
import { integrationStorageMigration } from "./002IntegrationStorage.js";
import { playStatusFoundationMigration } from "./003PlayStatusFoundation.js";
import { savedViewPlayStatusMigration } from "./004SavedViewPlayStatus.js";

export const migrations: readonly Migration[] = [
  initialSchemaMigration,
  integrationStorageMigration,
  playStatusFoundationMigration,
  savedViewPlayStatusMigration,
];
