import { HttpError } from "../../errors/httpError.js";
import {
  PORTABLE_DATA_FORMAT,
  PORTABLE_DATA_VERSION,
  type PortableDataExport,
} from "./portableDataTypes.js";
import { parsePortableDataV5 } from "./portableDataV5Validation.js";

function invalid(message: string): never {
  throw new HttpError(400, "invalid_portable_data", message);
}

export function parsePortableDataExport(value: unknown): PortableDataExport {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return invalid("The portable export must be a JSON object.");
  }

  const root = value as Record<string, unknown>;

  if (root.format !== PORTABLE_DATA_FORMAT) {
    return invalid(`format must be ${PORTABLE_DATA_FORMAT}.`);
  }

  if (root.formatVersion !== PORTABLE_DATA_VERSION) {
    throw new HttpError(
      400,
      "unsupported_portable_data_version",
      `Only portable data version ${PORTABLE_DATA_VERSION} is supported.`,
    );
  }

  return parsePortableDataV5(value);
}
