import { createHash, randomUUID } from "node:crypto";
import { access, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { HttpError } from "../../errors/httpError.js";
import { ImageCacheRepository } from "./imageCacheRepository.js";
import type {
  CachedImageContentType,
  ImageProvider,
  ImageRefreshResult,
  RegisterCachedImageInput,
} from "./imageCacheTypes.js";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const IMAGE_REQUEST_TIMEOUT_MS = 30_000;

const allowedHosts: Readonly<Record<ImageProvider, ReadonlySet<string>>> = {
  igdb: new Set(["images.igdb.com"]),
  playstation: new Set([
    "image.api.playstation.com",
    "psnobj.prod.dl.playstation.net",
  ]),
};

const extensions: Readonly<Record<CachedImageContentType, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type ImageFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

function assertAllowedSourceUrl(provider: ImageProvider, rawUrl: string): URL {
  let sourceUrl: URL;

  try {
    sourceUrl = new URL(rawUrl);
  } catch {
    throw new HttpError(
      400,
      "invalid_image_source",
      "The image source must be a valid HTTPS URL.",
    );
  }

  if (
    sourceUrl.protocol !== "https:" ||
    sourceUrl.username !== "" ||
    sourceUrl.password !== "" ||
    !allowedHosts[provider].has(sourceUrl.hostname.toLowerCase())
  ) {
    throw new HttpError(
      400,
      "invalid_image_source",
      `The image source is not an approved ${provider} image host.`,
    );
  }

  return sourceUrl;
}

function readContentType(response: Response): CachedImageContentType {
  const contentType = response.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();

  if (
    contentType !== "image/jpeg" &&
    contentType !== "image/png" &&
    contentType !== "image/webp"
  ) {
    throw new HttpError(
      502,
      "unsupported_image_type",
      "The image provider returned an unsupported file type.",
    );
  }

  return contentType;
}

function hasExpectedSignature(
  contentType: CachedImageContentType,
  bytes: Uint8Array,
): boolean {
  if (contentType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (contentType === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

    return signature.every((byte, index) => bytes[index] === byte);
  }

  return (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

async function readLimitedBody(response: Response): Promise<Uint8Array> {
  const contentLength = response.headers.get("content-length");

  if (contentLength !== null) {
    const declaredBytes = Number(contentLength);

    if (!Number.isSafeInteger(declaredBytes) || declaredBytes < 0) {
      throw new HttpError(
        502,
        "invalid_image_size",
        "The image provider returned an invalid file size.",
      );
    }

    if (declaredBytes > MAX_IMAGE_BYTES) {
      throw new HttpError(
        502,
        "image_too_large",
        "The image provider returned a file larger than 10 MB.",
      );
    }
  }

  if (response.body === null) {
    throw new HttpError(
      502,
      "empty_image_response",
      "The image provider returned no file data.",
    );
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteSize = 0;

  while (true) {
    const result = await reader.read();

    if (result.done) {
      break;
    }

    byteSize += result.value.byteLength;

    if (byteSize > MAX_IMAGE_BYTES) {
      await reader.cancel();

      throw new HttpError(
        502,
        "image_too_large",
        "The image provider returned a file larger than 10 MB.",
      );
    }

    chunks.push(result.value);
  }

  if (byteSize === 0) {
    throw new HttpError(
      502,
      "empty_image_response",
      "The image provider returned an empty file.",
    );
  }

  const bytes = new Uint8Array(byteSize);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return bytes;
}

export class ImageCacheService {
  private refreshQueue: Promise<void> = Promise.resolve();

  private readonly activeRefreshes = new Map<
    string,
    Promise<ImageRefreshResult>
  >();

  constructor(
    private readonly repository: ImageCacheRepository,
    private readonly cacheDirectory: string,
    private readonly fetchImage: ImageFetch = fetch,
  ) {}

  register(input: RegisterCachedImageInput) {
    const sourceKey = input.sourceKey.trim();

    if (sourceKey === "") {
      throw new HttpError(
        400,
        "invalid_image_source_key",
        "The image source key cannot be empty.",
      );
    }

    const sourceUrl = assertAllowedSourceUrl(
      input.provider,
      input.sourceUrl,
    ).toString();

    return this.repository.register({
      provider: input.provider,
      sourceKey,
      sourceUrl,
    });
  }

  refresh(imageId: string): Promise<ImageRefreshResult> {
    const activeRefresh = this.activeRefreshes.get(imageId);

    if (activeRefresh !== undefined) {
      return activeRefresh;
    }

    const refreshResult = this.refreshQueue.then(() =>
      this.refreshImmediately(imageId),
    );

    this.activeRefreshes.set(imageId, refreshResult);

    this.refreshQueue = refreshResult.then(
      () => undefined,
      () => undefined,
    );

    void refreshResult.then(
      () => {
        this.activeRefreshes.delete(imageId);
      },
      () => {
        this.activeRefreshes.delete(imageId);
      },
    );

    return refreshResult;
  }

  private async refreshImmediately(
    imageId: string,
  ): Promise<ImageRefreshResult> {
    const image = this.repository.findById(imageId);

    if (image === null) {
      throw new HttpError(404, "image_not_found", "Cached image not found.");
    }

    const existingPath =
      image.fileName === null
        ? null
        : this.resolveExistingCachePath(image.fileName);

    const hasLocalCopy =
      existingPath !== null &&
      (await access(existingPath).then(
        () => true,
        () => false,
      ));

    const headers = new Headers({
      accept: "image/webp,image/png,image/jpeg;q=0.9",
    });

    if (hasLocalCopy && image.etag !== null) {
      headers.set("if-none-match", image.etag);
    }

    if (hasLocalCopy && image.lastModified !== null) {
      headers.set("if-modified-since", image.lastModified);
    }

    const response = await this.fetchWithSafeRedirects(
      image.provider,
      image.sourceUrl,
      headers,
    );

    const timestamp = new Date().toISOString();

    if (response.status === 304) {
      if (!hasLocalCopy) {
        throw new HttpError(
          502,
          "invalid_image_response",
          "The image provider returned not-modified before a local copy existed.",
        );
      }

      return {
        image: this.repository.markChecked(imageId, timestamp),
        status: "not_modified",
      };
    }

    if (!response.ok) {
      throw new HttpError(
        502,
        "image_provider_error",
        `The image provider returned HTTP ${response.status}.`,
      );
    }

    const contentType = readContentType(response);
    const bytes = await readLimitedBody(response);

    if (!hasExpectedSignature(contentType, bytes)) {
      throw new HttpError(
        502,
        "invalid_image_file",
        "The image provider response does not match its declared file type.",
      );
    }

    await mkdir(this.cacheDirectory, { recursive: true });

    const safeId = createHash("sha256").update(image.id).digest("hex");
    const fileName = `${safeId}-${randomUUID()}.${extensions[contentType]}`;
    const temporaryName = `.${fileName}.partial`;
    const temporaryPath = resolve(this.cacheDirectory, temporaryName);
    const finalPath = resolve(this.cacheDirectory, fileName);

    let finalFileCreated = false;

    try {
      await writeFile(temporaryPath, bytes, { flag: "wx" });
      await rename(temporaryPath, finalPath);
      finalFileCreated = true;

      const storedImage = this.repository.markStored({
        imageId,
        fileName,
        contentType,
        byteSize: bytes.byteLength,
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
        timestamp,
      });

      if (image.fileName !== null && image.fileName !== fileName) {
        const oldPath = this.resolveExistingCachePath(image.fileName);

        if (oldPath !== null) {
          await rm(oldPath, { force: true }).catch(() => undefined);
        }
      }

      return {
        image: storedImage,
        status: "downloaded",
      };
    } catch (error) {
      await rm(temporaryPath, { force: true });

      if (finalFileCreated) {
        await rm(finalPath, { force: true });
      }

      throw error;
    }
  }

  private resolveExistingCachePath(fileName: string): string | null {
    const safeCacheDirectory = resolve(this.cacheDirectory);
    const filePath = resolve(safeCacheDirectory, fileName);

    return basename(fileName) === fileName &&
      dirname(filePath) === safeCacheDirectory
      ? filePath
      : null;
  }

  private async fetchWithSafeRedirects(
    provider: ImageProvider,
    rawUrl: string,
    headers: Headers,
  ): Promise<Response> {
    let currentUrl = assertAllowedSourceUrl(provider, rawUrl);

    for (let redirectCount = 0; ; redirectCount += 1) {
      let response: Response;

      try {
        response = await this.fetchImage(currentUrl, {
          headers,
          redirect: "manual",
          signal: AbortSignal.timeout(IMAGE_REQUEST_TIMEOUT_MS),
        });
      } catch {
        throw new HttpError(
          502,
          "image_provider_unavailable",
          "The image provider could not be reached.",
        );
      }

      if (![301, 302, 303, 307, 308].includes(response.status)) {
        return response;
      }

      if (redirectCount >= MAX_REDIRECTS) {
        throw new HttpError(
          502,
          "too_many_image_redirects",
          "The image provider redirected too many times.",
        );
      }

      const location = response.headers.get("location");

      if (location === null) {
        throw new HttpError(
          502,
          "invalid_image_redirect",
          "The image provider returned a redirect without a destination.",
        );
      }

      currentUrl = assertAllowedSourceUrl(
        provider,
        new URL(location, currentUrl).toString(),
      );
    }
  }
}
