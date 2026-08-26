export const imageProviders = ["igdb", "playstation"] as const;

export type ImageProvider = (typeof imageProviders)[number];

export type CachedImageContentType = "image/jpeg" | "image/png" | "image/webp";

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
