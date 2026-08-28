import { HttpError } from "../../errors/httpError.js";
import type {
  CreateCollectionInput,
  UpdateCollectionInput,
} from "./collectionTypes.js";

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 2_000;

function requireRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(
      400,
      "invalid_request_body",
      "The request body must be a JSON object.",
    );
  }

  return value as Record<string, unknown>;
}

function rejectUnknownKeys(
  record: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
): void {
  const unknownKeys = Object.keys(record).filter(
    (key) => !allowedKeys.has(key),
  );

  if (unknownKeys.length > 0) {
    throw new HttpError(
      400,
      "unknown_fields",
      `Unknown field${unknownKeys.length === 1 ? "" : "s"}: ${unknownKeys.join(", ")}.`,
    );
  }
}

function readName(value: unknown): string {
  if (typeof value !== "string") {
    throw new HttpError(
      400,
      "invalid_collection_name",
      "name must be a string.",
    );
  }

  const name = value.trim();

  if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
    throw new HttpError(
      400,
      "invalid_collection_name",
      `name must contain between 1 and ${MAX_NAME_LENGTH} characters.`,
    );
  }

  return name;
}

function readDescription(value: unknown): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(
      400,
      "invalid_collection_description",
      "description must be a string or null.",
    );
  }

  const description = value.trim();

  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new HttpError(
      400,
      "invalid_collection_description",
      `description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters.`,
    );
  }

  return description.length === 0 ? null : description;
}

function readIdArray(
  value: unknown,
  errorCode: string,
  fieldName: string,
): string[] {
  if (!Array.isArray(value)) {
    throw new HttpError(
      400,
      errorCode,
      `${fieldName} must be an array of IDs.`,
    );
  }

  const ids = value.map((id) => {
    if (typeof id !== "string" || id.trim().length === 0) {
      throw new HttpError(
        400,
        errorCode,
        `Every ${fieldName} entry must be a non-empty string.`,
      );
    }

    return id.trim();
  });

  if (new Set(ids).size !== ids.length) {
    throw new HttpError(
      400,
      "duplicate_ids",
      `${fieldName} cannot contain duplicate IDs.`,
    );
  }

  return ids;
}

export function parseCreateCollectionInput(
  value: unknown,
): CreateCollectionInput {
  const record = requireRecord(value);

  rejectUnknownKeys(record, new Set(["name", "description"]));

  const input: {
    name: string;
    description?: string | null;
  } = {
    name: readName(record.name),
  };

  if (record.description !== undefined) {
    input.description = readDescription(record.description);
  }

  return input;
}

export function parseUpdateCollectionInput(
  value: unknown,
): UpdateCollectionInput {
  const record = requireRecord(value);

  rejectUnknownKeys(record, new Set(["name", "description"]));

  if (Object.keys(record).length === 0) {
    throw new HttpError(
      400,
      "empty_update",
      "Provide at least one field to update.",
    );
  }

  const input: {
    name?: string;
    description?: string | null;
  } = {};

  if (record.name !== undefined) {
    input.name = readName(record.name);
  }

  if (Object.hasOwn(record, "description")) {
    input.description = readDescription(record.description);
  }

  return input;
}

export function parseCollectionOrder(value: unknown): readonly string[] {
  const record = requireRecord(value);

  rejectUnknownKeys(record, new Set(["orderedCollectionIds"]));

  return readIdArray(
    record.orderedCollectionIds,
    "invalid_collection_order",
    "orderedCollectionIds",
  );
}

export function parseCollectionGameOrder(value: unknown): readonly string[] {
  const record = requireRecord(value);

  rejectUnknownKeys(record, new Set(["orderedGameIds"]));

  return readIdArray(
    record.orderedGameIds,
    "invalid_collection_game_order",
    "orderedGameIds",
  );
}

export function parseGameCollectionMemberships(
  value: unknown,
): readonly string[] {
  const record = requireRecord(value);

  rejectUnknownKeys(record, new Set(["collectionIds"]));

  return readIdArray(
    record.collectionIds,
    "invalid_game_collection_memberships",
    "collectionIds",
  );
}
