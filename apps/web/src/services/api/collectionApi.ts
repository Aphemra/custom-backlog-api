import type {
  CollectionDetail,
  CollectionInput,
  CollectionSummary,
} from "../../domain/collection";
import { requestJson, requestVoid } from "./apiClient";

interface CollectionResponse {
  readonly collection: CollectionDetail;
}

interface NullableCollectionResponse {
  readonly collection: CollectionDetail | null;
}

interface CollectionsResponse {
  readonly collections: readonly CollectionSummary[];
}

interface CollectionMembershipsResponse {
  readonly collectionIds: readonly string[];
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

  async setPinned(
    collectionId: string | null,
  ): Promise<CollectionDetail | null> {
    const response = await requestJson<NullableCollectionResponse>(
      "/api/collections/pinned",
      {
        method: "PUT",
        body: JSON.stringify({ collectionId }),
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

  async replaceGameMemberships(
    gameId: string,
    collectionIds: readonly string[],
  ): Promise<readonly string[]> {
    const response = await requestJson<CollectionMembershipsResponse>(
      `/api/collections/memberships/${encodeURIComponent(gameId)}`,
      {
        method: "PUT",
        body: JSON.stringify({ collectionIds }),
      },
    );

    return response.collectionIds;
  },

  async deletePermanently(collectionId: string): Promise<void> {
    await requestVoid(`/api/collections/${encodeURIComponent(collectionId)}`, {
      method: "DELETE",
    });
  },
};
