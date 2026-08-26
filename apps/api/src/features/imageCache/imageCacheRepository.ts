import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type {
  CachedImage,
  CachedImageContentType,
  ImageProvider,
  RegisterCachedImageInput,
  StoreCachedImageInput,
} from "./imageCacheTypes.js";

interface CachedImageRow {
  id: string;
  provider: ImageProvider;
  source_key: string;
  source_url: string;
  file_name: string | null;
  content_type: CachedImageContentType | null;
  byte_size: number | null;
  etag: string | null;
  last_modified: string | null;
  fetched_at: string | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapCachedImage(row: CachedImageRow): CachedImage {
  return {
    id: row.id,
    provider: row.provider,
    sourceKey: row.source_key,
    sourceUrl: row.source_url,
    fileName: row.file_name,
    contentType: row.content_type,
    byteSize: row.byte_size,
    etag: row.etag,
    lastModified: row.last_modified,
    fetchedAt: row.fetched_at,
    lastCheckedAt: row.last_checked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ImageCacheRepository {
  constructor(private readonly database: DatabaseSync) {}

  findById(imageId: string): CachedImage | null {
    const row = this.database
      .prepare(
        `
        SELECT
          id,
          provider,
          source_key,
          source_url,
          file_name,
          content_type,
          byte_size,
          etag,
          last_modified,
          fetched_at,
          last_checked_at,
          created_at,
          updated_at
        FROM cached_images
        WHERE id = ?
      `,
      )
      .get(imageId) as unknown as CachedImageRow | undefined;

    return row === undefined ? null : mapCachedImage(row);
  }

  register(input: RegisterCachedImageInput): CachedImage {
    const existing = this.findBySource(input.provider, input.sourceKey);
    const timestamp = new Date().toISOString();

    if (existing !== null) {
      if (existing.sourceUrl !== input.sourceUrl) {
        this.database
          .prepare(
            `
            UPDATE cached_images
            SET source_url = ?, updated_at = ?
            WHERE id = ?
          `,
          )
          .run(input.sourceUrl, timestamp, existing.id);
      }

      return this.requireById(existing.id);
    }

    const imageId = randomUUID();

    this.database
      .prepare(
        `
        INSERT INTO cached_images (
          id,
          provider,
          source_key,
          source_url,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        imageId,
        input.provider,
        input.sourceKey,
        input.sourceUrl,
        timestamp,
        timestamp,
      );

    return this.requireById(imageId);
  }

  markChecked(imageId: string, timestamp: string): CachedImage {
    this.database
      .prepare(
        `
        UPDATE cached_images
        SET last_checked_at = ?, updated_at = ?
        WHERE id = ?
      `,
      )
      .run(timestamp, timestamp, imageId);

    return this.requireById(imageId);
  }

  markStored(input: StoreCachedImageInput): CachedImage {
    this.database
      .prepare(
        `
        UPDATE cached_images
        SET
          file_name = ?,
          content_type = ?,
          byte_size = ?,
          etag = ?,
          last_modified = ?,
          fetched_at = ?,
          last_checked_at = ?,
          updated_at = ?
        WHERE id = ?
      `,
      )
      .run(
        input.fileName,
        input.contentType,
        input.byteSize,
        input.etag,
        input.lastModified,
        input.timestamp,
        input.timestamp,
        input.timestamp,
        input.imageId,
      );

    return this.requireById(input.imageId);
  }

  private findBySource(
    provider: ImageProvider,
    sourceKey: string,
  ): CachedImage | null {
    const row = this.database
      .prepare(
        `
        SELECT
          id,
          provider,
          source_key,
          source_url,
          file_name,
          content_type,
          byte_size,
          etag,
          last_modified,
          fetched_at,
          last_checked_at,
          created_at,
          updated_at
        FROM cached_images
        WHERE provider = ? AND source_key = ?
      `,
      )
      .get(provider, sourceKey) as unknown as CachedImageRow | undefined;

    return row === undefined ? null : mapCachedImage(row);
  }

  private requireById(imageId: string): CachedImage {
    const image = this.findById(imageId);

    if (image === null) {
      throw new Error(
        `Cached image ${imageId} disappeared during a database operation.`,
      );
    }

    return image;
  }
}
