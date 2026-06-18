import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PsnProfilesUserscriptExportPayload, StoredPsnProfilesImport } from "./psnProfilesImportTypes.js";
import { validatePsnProfilesUserscriptExport } from "./validatePsnProfilesUserscriptExport.js";

const DEFAULT_IMPORT_STORAGE_PATH = "data/psnprofiles-import-latest.json";

export async function saveLatestPsnProfilesImport(payload: PsnProfilesUserscriptExportPayload): Promise<StoredPsnProfilesImport> {
  const storedImport: StoredPsnProfilesImport = {
    savedAt: new Date().toISOString(),
    payload,
  };

  const storagePath = getStoragePath();

  await mkdir(path.dirname(storagePath), {
    recursive: true,
  });

  await writeFile(storagePath, JSON.stringify(storedImport, null, 2), "utf-8");

  return storedImport;
}

export async function readLatestPsnProfilesImport(): Promise<StoredPsnProfilesImport | null> {
  const storagePath = getStoragePath();

  try {
    const fileText = await readFile(storagePath, "utf-8");
    const parsedData = JSON.parse(fileText) as unknown;

    return validateStoredImport(parsedData);
  } catch (error) {
    if (isErrorWithCode(error) && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function validateStoredImport(data: unknown): StoredPsnProfilesImport {
  if (!isRecord(data)) {
    throw new Error("Stored PSNProfiles import was not a JSON object.");
  }

  if (typeof data.savedAt !== "string") {
    throw new Error("Stored PSNProfiles import is missing savedAt.");
  }

  return {
    savedAt: data.savedAt,
    payload: validatePsnProfilesUserscriptExport(data.payload),
  };
}

function getStoragePath(): string {
  return path.resolve(process.cwd(), process.env.PSNPROFILES_IMPORT_STORAGE_PATH?.trim() || DEFAULT_IMPORT_STORAGE_PATH);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isErrorWithCode(error: unknown): error is Error & { code: string } {
  return error instanceof Error && "code" in error && typeof (error as { code?: unknown }).code === "string";
}
