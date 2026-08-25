import type {
  CollectionDetail,
  CollectionInput,
  CollectionSummary,
} from "../../domain/collection";
import { requestJson, requestVoid } from "./apiClient";

interface CollectionResponse {
  readonly collection: CollectionDetail;
}

interface CollectionsResponse {
  readonly collections: readonly CollectionSummary[];
}

export const collectionApi = {
  async list(signal?: AbortSignal): Promise<readonly CollectionSummary[]> {
    const response = await requestJson<CollectionsResponse>(
      "/api/collections",
      { signal },
    );

    return response.collections;
  },

  async get(collectionId: string): Promise<CollectionDetail> {
    const response = await requestJson<CollectionResponse>(
      `/api/collections/${encodeURIComponent(collectionId)}`,
    );

    return response.collection;
  },

  async create(input: CollectionInput): Promise<CollectionDetail> {
    const response = await requestJson<CollectionResponse>("/api/collections", {
      method: "POST",
      body: JSON.stringify(input),
    });

    return response.collection;
  },

  async update(
    collectionId: string,
    input: CollectionInput,
  ): Promise<CollectionDetail> {
    const response = await requestJson<CollectionResponse>(
      `/api/collections/${encodeURIComponent(collectionId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );

    return response.collection;
  },

  async reorder(
    orderedCollectionIds: readonly string[],
  ): Promise<readonly CollectionSummary[]> {
    const response = await requestJson<CollectionsResponse>(
      "/api/collections/order",
      {
        method: "PUT",
        body: JSON.stringify({ orderedCollectionIds }),
      },
    );

    return response.collections;
  },

  async replaceGames(
    collectionId: string,
    orderedGameIds: readonly string[],
  ): Promise<CollectionDetail> {
    const response = await requestJson<CollectionResponse>(
      `/api/collections/${encodeURIComponent(collectionId)}/games`,
      {
        method: "PUT",
        body: JSON.stringify({ orderedGameIds }),
      },
    );

    return response.collection;
  },

  async deletePermanently(collectionId: string): Promise<void> {
    await requestVoid(`/api/collections/${encodeURIComponent(collectionId)}`, {
      method: "DELETE",
    });
  },
};
