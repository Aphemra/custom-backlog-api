export const imageProviders = ["igdb", "playstation"] as const;

export type ImageProvider = (typeof imageProviders)[number];

export type CachedImageContentType = "image/jpeg" | "image/png" | "image/webp";

export const IMAGE_REVALIDATION_INTERVAL_MS = 30 * 24 * 60 * 60 * 1_000;

export interface CachedImage {
  id: string;
  provider: ImageProvider;
  sourceKey: string;
  sourceUrl: string;
  fileName: string | null;
  contentType: CachedImageContentType | null;
  byteSize: number | null;
  etag: string | null;
  lastModified: string | null;
  fetchedAt: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function isImageRevalidationDue(
  image: Pick<CachedImage, "lastCheckedAt" | "fetchedAt" | "createdAt">,
  now: number = Date.now(),
): boolean {
  const previousCheck =
    image.lastCheckedAt ?? image.fetchedAt ?? image.createdAt;

  const previousCheckTime = Date.parse(previousCheck);

  return (
    !Number.isFinite(previousCheckTime) ||
    now - previousCheckTime >= IMAGE_REVALIDATION_INTERVAL_MS
  );
}

export interface RegisterCachedImageInput {
  provider: ImageProvider;
  sourceKey: string;
  sourceUrl: string;
}

export interface StoreCachedImageInput {
  imageId: string;
  fileName: string;
  contentType: CachedImageContentType;
  byteSize: number;
  etag: string | null;
  lastModified: string | null;
  timestamp: string;
}

export interface ImageRefreshResult {
  image: CachedImage;
  status: "downloaded" | "not_modified";
}
