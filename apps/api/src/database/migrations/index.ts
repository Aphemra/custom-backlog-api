import type { Migration } from "../migration.js";
import { initialSchemaMigration } from "./001InitialSchema.js";
import { integrationStorageMigration } from "./002IntegrationStorage.js";

export const migrations: readonly Migration[] = [
  initialSchemaMigration,
  integrationStorageMigration,
];
