import type {
  CreateGameResourceInput,
  GameResource,
  UpdateGameResourceInput,
} from "../../domain/gameResource";
import { requestJson, requestVoid } from "./apiClient";

interface GameResourceResponse {
  readonly resource: GameResource;
}

interface GameResourcesResponse {
  readonly resources: readonly GameResource[];
}

function gameResourcesPath(gameId: string): string {
  return `/api/library/games/${encodeURIComponent(gameId)}/resources`;
}

export const gameResourceApi = {
  async list(
    gameId: string,
    signal?: AbortSignal,
  ): Promise<readonly GameResource[]> {
    const response = await requestJson<GameResourcesResponse>(
      gameResourcesPath(gameId),
      { signal },
    );

    return response.resources;
  },

  async create(
    gameId: string,
    input: CreateGameResourceInput,
  ): Promise<GameResource> {
    const response = await requestJson<GameResourceResponse>(
      gameResourcesPath(gameId),
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );

    return response.resource;
  },

  async update(
    gameId: string,
    resourceId: string,
    input: UpdateGameResourceInput,
  ): Promise<GameResource> {
    const response = await requestJson<GameResourceResponse>(
      `${gameResourcesPath(gameId)}/${encodeURIComponent(resourceId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );

    return response.resource;
  },

  async reorder(
    gameId: string,
    orderedResourceIds: readonly string[],
  ): Promise<readonly GameResource[]> {
    const response = await requestJson<GameResourcesResponse>(
      `${gameResourcesPath(gameId)}/order`,
      {
        method: "PUT",
        body: JSON.stringify({ orderedResourceIds }),
      },
    );

    return response.resources;
  },

  async deletePermanently(gameId: string, resourceId: string): Promise<void> {
    await requestVoid(
      `${gameResourcesPath(gameId)}/${encodeURIComponent(resourceId)}`,
      { method: "DELETE" },
    );
  },
};
