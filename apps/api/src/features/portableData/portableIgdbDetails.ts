import type { DatabaseSync, StatementSync } from "node:sqlite";
import { parseIgdbGames } from "../igdb/igdbClient.js";
import { IgdbMetadataRepository } from "../igdb/igdbMetadataRepository.js";
import type { IgdbTimeToBeat, IgdbImageReference } from "../igdb/igdbTypes.js";
import type {
  PortableExternalGameMetadata,
  PortableJsonValue,
} from "./portableDataV3Types.js";

const PORTABLE_IGDB_DETAILS_KEY = "__trophyBacklogIgdbDetails";

interface CachedImageIdRow {
  id: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNullablePositiveInteger(
  value: unknown,
): number | null | undefined {
  if (value === null) {
    return null;
  }

  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : undefined;
}

function readNonnegativeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined;
}

function readPortableTimeToBeat(
  payload: PortableJsonValue,
): IgdbTimeToBeat | null {
  if (!isRecord(payload)) {
    return null;
  }

  const marker = payload[PORTABLE_IGDB_DETAILS_KEY];

  if (!isRecord(marker)) {
    return null;
  }

  const timeToBeat = marker.timeToBeat;

  if (timeToBeat === null) {
    return null;
  }

  if (!isRecord(timeToBeat)) {
    return null;
  }

  const hastilySeconds = readNullablePositiveInteger(timeToBeat.hastilySeconds);

  const normallySeconds = readNullablePositiveInteger(
    timeToBeat.normallySeconds,
  );

  const completelySeconds = readNullablePositiveInteger(
    timeToBeat.completelySeconds,
  );

  const submissionCount = readNonnegativeInteger(timeToBeat.submissionCount);

  if (
    hastilySeconds === undefined ||
    normallySeconds === undefined ||
    completelySeconds === undefined ||
    submissionCount === undefined
  ) {
    return null;
  }

  return {
    hastilySeconds,
    normallySeconds,
    completelySeconds,
    submissionCount,
  };
}

export function addPortableIgdbDetails(
  payload: PortableJsonValue,
  timeToBeat: IgdbTimeToBeat | null,
): PortableJsonValue {
  if (
    payload === null ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return payload;
  }

  return {
    ...payload,

    [PORTABLE_IGDB_DETAILS_KEY]: {
      schemaVersion: 1,

      timeToBeat:
        timeToBeat === null
          ? null
          : {
              hastilySeconds: timeToBeat.hastilySeconds,
              normallySeconds: timeToBeat.normallySeconds,
              completelySeconds: timeToBeat.completelySeconds,
              submissionCount: timeToBeat.submissionCount,
            },
    },
  };
}

function insertImageLink(
  findImage: StatementSync,
  insertImage: StatementSync,
  metadataId: string,
  sourceKey: string,
  role: "cover" | "screenshot" | "artwork",
  sortOrder: number,
  reference: IgdbImageReference | null,
  linkedAt: string,
): void {
  const row = findImage.get(sourceKey) as unknown as
    | CachedImageIdRow
    | undefined;

  if (row === undefined) {
    return;
  }

  insertImage.run(
    metadataId,
    row.id,
    role,
    sortOrder,
    reference?.width ?? null,
    reference?.height ?? null,
    linkedAt,
  );
}

export function restorePortableIgdbDetails(
  database: DatabaseSync,
  metadataItems: readonly PortableExternalGameMetadata[],
): void {
  const metadataRepository = new IgdbMetadataRepository(database);

  const findImage = database.prepare(`
    SELECT id
    FROM cached_images
    WHERE provider = 'igdb' AND source_key = ?
  `);

  const insertImage = database.prepare(`
    INSERT INTO igdb_metadata_images (
      metadata_id,
      image_id,
      role,
      sort_order,
      width,
      height,
      linked_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const metadata of metadataItems) {
    if (metadata.provider !== "igdb") {
      continue;
    }

    let parsedGame;

    try {
      parsedGame = parseIgdbGames([metadata.payload])[0];
    } catch {
      continue;
    }

    if (
      parsedGame === undefined ||
      parsedGame.externalId !== metadata.externalId
    ) {
      continue;
    }

    const stored = metadataRepository.upsert(
      {
        ...parsedGame,
        timeToBeat: readPortableTimeToBeat(metadata.payload),
      },
      metadata.fetchedAt,
    );

    if (stored.metadataId !== metadata.id) {
      throw new Error(
        `IGDB metadata ${metadata.id} changed identity during import.`,
      );
    }

    if (parsedGame.coverImageId !== null) {
      insertImageLink(
        findImage,
        insertImage,
        metadata.id,
        `cover:${parsedGame.coverImageId}`,
        "cover",
        0,
        null,
        metadata.fetchedAt,
      );
    }

    parsedGame.screenshots.forEach((reference, sortOrder) => {
      insertImageLink(
        findImage,
        insertImage,
        metadata.id,
        `screenshot:${reference.imageId}`,
        "screenshot",
        sortOrder,
        reference,
        metadata.fetchedAt,
      );
    });

    parsedGame.artworks.forEach((reference, sortOrder) => {
      insertImageLink(
        findImage,
        insertImage,
        metadata.id,
        `artwork:${reference.imageId}`,
        "artwork",
        sortOrder,
        reference,
        metadata.fetchedAt,
      );
    });
  }
}
