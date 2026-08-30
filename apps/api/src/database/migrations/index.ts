import type { Migration } from "../migration.js";
import { initialSchemaMigration } from "./001InitialSchema.js";

export const migrations: readonly Migration[] = [initialSchemaMigration];
