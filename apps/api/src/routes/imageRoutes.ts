import { existsSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { Router } from "express";
import { HttpError } from "../errors/httpError.js";
import { ImageCacheRepository } from "../features/imageCache/imageCacheRepository.js";

export function createImageRoutes(
  database: DatabaseSync,
  cacheDirectory: string,
): Router {
  const imageRoutes = Router();
  const repository = new ImageCacheRepository(database);
  const safeCacheDirectory = resolve(cacheDirectory);

  imageRoutes.get("/:imageId", (request, response) => {
    const image = repository.findById(request.params.imageId);

    if (image === null) {
      throw new HttpError(404, "image_not_found", "Cached image not found.");
    }

    if (image.fileName === null || image.contentType === null) {
      throw new HttpError(
        404,
        "image_not_cached",
        "This image does not have a local copy yet.",
      );
    }

    const imagePath = resolve(safeCacheDirectory, image.fileName);

    if (
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
  });

  return imageRoutes;
}
