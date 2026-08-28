import { HttpError } from "../../errors/httpError.js";
import {
  gameResourceTypes,
  type CreateGameResourceInput,
  type GameResourceProvider,
  type GameResourceType,
  type UpdateGameResourceInput,
} from "./gameResourceTypes.js";

const MAX_URL_LENGTH = 2_048;
const MAX_LABEL_LENGTH = 100;

const psnProfilesHosts = new Set(["psnprofiles.com", "www.psnprofiles.com"]);

const powerPyxHosts = new Set(["powerpyx.com", "www.powerpyx.com"]);

const mapGenieHosts = new Set(["mapgenie.io", "www.mapgenie.io"]);

export interface ResolvedGameResourceTarget {
  readonly resourceType: GameResourceType;
  readonly provider: GameResourceProvider;
  readonly url: string;
}

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
      `Unknown field${
        unknownKeys.length === 1 ? "" : "s"
      }: ${unknownKeys.join(", ")}.`,
    );
  }
}

function readResourceType(value: unknown): GameResourceType {
  if (!gameResourceTypes.includes(value as GameResourceType)) {
    throw new HttpError(
      400,
      "invalid_resource_type",
      `resourceType must be one of: ${gameResourceTypes.join(", ")}.`,
    );
  }

  return value as GameResourceType;
}

function normalizeHttpsUrl(value: unknown): URL {
  if (typeof value !== "string") {
    throw new HttpError(400, "invalid_resource_url", "url must be a string.");
  }

  const rawUrl = value.trim();

  if (rawUrl.length === 0) {
    throw new HttpError(400, "invalid_resource_url", "url cannot be empty.");
  }

  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new HttpError(
      400,
      "invalid_resource_url",
      "url must be a valid absolute HTTPS URL.",
    );
  }

  if (
    url.protocol !== "https:" ||
    url.hostname === "" ||
    url.username !== "" ||
    url.password !== ""
  ) {
    throw new HttpError(
      400,
      "invalid_resource_url",
      "url must use HTTPS and cannot contain embedded credentials.",
    );
  }

  if (url.toString().length > MAX_URL_LENGTH) {
    throw new HttpError(
      400,
      "invalid_resource_url",
      `url cannot exceed ${MAX_URL_LENGTH} characters.`,
    );
  }

  return url;
}

function detectProvider(url: URL): GameResourceProvider {
  const hostname = url.hostname.toLowerCase();

  if (psnProfilesHosts.has(hostname)) {
    return "psnprofiles";
  }

  if (powerPyxHosts.has(hostname)) {
    return "powerpyx";
  }

  if (mapGenieHosts.has(hostname)) {
    return "mapgenie";
  }

  return "other";
}

function assertCompatibleProvider(
  resourceType: GameResourceType,
  provider: GameResourceProvider,
): void {
  const compatible =
    resourceType === "trophy_page"
      ? provider === "psnprofiles"
      : resourceType === "guide"
        ? provider === "psnprofiles" ||
          provider === "powerpyx" ||
          provider === "other"
        : provider === "mapgenie" || provider === "other";

  if (!compatible) {
    throw new HttpError(
      400,
      "resource_provider_mismatch",
      `${provider} cannot be used for a ${resourceType} resource.`,
    );
  }
}

function assertProviderPath(
  resourceType: GameResourceType,
  provider: GameResourceProvider,
  url: URL,
): void {
  if (
    resourceType === "trophy_page" &&
    !/^\/trophies\/\d+(?:-[^/]+)?\/?$/u.test(url.pathname)
  ) {
    throw new HttpError(
      400,
      "invalid_trophy_page_url",
      "A PSNProfiles trophy-page URL must point to a specific /trophies/ page.",
    );
  }

  if (
    resourceType === "guide" &&
    provider === "psnprofiles" &&
    !url.pathname.startsWith("/guide/")
  ) {
    throw new HttpError(
      400,
      "invalid_guide_url",
      "A PSNProfiles guide URL must point to a specific /guide/ page.",
    );
  }
}

function readLabel(value: unknown): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(
      400,
      "invalid_resource_label",
      "label must be a string or null.",
    );
  }

  const label = value.trim();

  if (label.length > MAX_LABEL_LENGTH) {
    throw new HttpError(
      400,
      "invalid_resource_label",
      `label cannot exceed ${MAX_LABEL_LENGTH} characters.`,
    );
  }

  return label.length === 0 ? null : label;
}

export function resolveGameResourceTarget(
  resourceType: GameResourceType,
  rawUrl: unknown,
): ResolvedGameResourceTarget {
  const parsedUrl = normalizeHttpsUrl(rawUrl);
  const provider = detectProvider(parsedUrl);

  assertCompatibleProvider(resourceType, provider);
  assertProviderPath(resourceType, provider, parsedUrl);

  return {
    resourceType,
    provider,
    url: parsedUrl.toString(),
  };
}

export function parseCreateGameResourceInput(
  value: unknown,
): CreateGameResourceInput & {
  readonly provider: GameResourceProvider;
} {
  const record = requireRecord(value);

  rejectUnknownKeys(record, new Set(["resourceType", "url", "label"]));

  const resourceType = readResourceType(record.resourceType);

  const target = resolveGameResourceTarget(resourceType, record.url);

  return {
    resourceType: target.resourceType,
    provider: target.provider,
    url: target.url,

    ...(record.label === undefined
      ? {}
      : {
          label: readLabel(record.label),
        }),
  };
}

export function parseUpdateGameResourceInput(
  value: unknown,
): UpdateGameResourceInput {
  const record = requireRecord(value);

  rejectUnknownKeys(record, new Set(["resourceType", "url", "label"]));

  if (Object.keys(record).length === 0) {
    throw new HttpError(
      400,
      "empty_update",
      "Provide at least one field to update.",
    );
  }

  const input: {
    resourceType?: GameResourceType;
    url?: string;
    label?: string | null;
  } = {};

  if (record.resourceType !== undefined) {
    input.resourceType = readResourceType(record.resourceType);
  }

  if (record.url !== undefined) {
    input.url = normalizeHttpsUrl(record.url).toString();
  }

  if (Object.hasOwn(record, "label")) {
    input.label = readLabel(record.label);
  }

  if (input.resourceType !== undefined && input.url !== undefined) {
    const target = resolveGameResourceTarget(input.resourceType, input.url);

    input.url = target.url;
  }

  return input;
}

export function parseGameResourceOrder(value: unknown): readonly string[] {
  const record = requireRecord(value);

  rejectUnknownKeys(record, new Set(["orderedResourceIds"]));

  if (!Array.isArray(record.orderedResourceIds)) {
    throw new HttpError(
      400,
      "invalid_resource_order",
      "orderedResourceIds must be an array of resource IDs.",
    );
  }

  const resourceIds = record.orderedResourceIds.map((resourceId) => {
    if (typeof resourceId !== "string" || resourceId.trim().length === 0) {
      throw new HttpError(
        400,
        "invalid_resource_order",
        "Every orderedResourceIds entry must be a non-empty string.",
      );
    }

    return resourceId.trim();
  });

  if (new Set(resourceIds).size !== resourceIds.length) {
    throw new HttpError(
      400,
      "duplicate_resource_ids",
      "orderedResourceIds cannot contain duplicate IDs.",
    );
  }

  return resourceIds;
}
