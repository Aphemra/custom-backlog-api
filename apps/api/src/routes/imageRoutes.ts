import { existsSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { Router } from "express";
import { HttpError } from "../errors/httpError.js";
import { ImageCacheRepository } from "../features/imageCache/imageCacheRepository.js";
import {
  ImageCacheService,
  type ImageFetch,
} from "../features/imageCache/imageCacheService.js";

export function createImageRoutes(
  database: DatabaseSync,
  cacheDirectory: string,
  fetchImage: ImageFetch = fetch,
): Router {
  const imageRoutes = Router();
  const repository = new ImageCacheRepository(database);
  const service = new ImageCacheService(repository, cacheDirectory, fetchImage);
  const safeCacheDirectory = resolve(cacheDirectory);

  imageRoutes.get("/:imageId", async (request, response, next) => {
    try {
      let image = repository.findById(request.params.imageId);

      if (image === null) {
        throw new HttpError(404, "image_not_found", "Cached image not found.");
      }

      let imagePath =
        image.fileName === null
          ? null
          : resolve(safeCacheDirectory, image.fileName);

      const hasSafeLocalCopy =
        image.fileName !== null &&
        image.contentType !== null &&
        basename(image.fileName) === image.fileName &&
        imagePath !== null &&
        dirname(imagePath) === safeCacheDirectory &&
        existsSync(imagePath);

      if (!hasSafeLocalCopy) {
        image = (await service.refresh(image.id)).image;
        imagePath =
          image.fileName === null
            ? null
            : resolve(safeCacheDirectory, image.fileName);
      }

      if (
        image.fileName === null ||
        image.contentType === null ||
        imagePath === null ||
        basename(image.fileName) !== image.fileName ||
        dirname(imagePath) !== safeCacheDirectory ||
        !existsSync(imagePath)
      ) {
        throw new HttpError(
          404,
          "image_not_cached",
          "The local image copy is missing.",
        );
      }

      response.setHeader("cache-control", "private, max-age=3600");
      response.type(image.contentType);
      response.sendFile(imagePath);
    } catch (error) {
      next(error);
    }
  });

  return imageRoutes;
}
