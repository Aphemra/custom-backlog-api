import type {
  SavedView,
  SavedViewGames,
  SavedViewInput,
} from "../../domain/savedView";
import { requestJson, requestVoid } from "./apiClient";

interface ViewsResponse {
  readonly views: readonly SavedView[];
}

interface ViewResponse {
  readonly view: SavedView;
}

export const savedViewApi = {
  async list(signal?: AbortSignal): Promise<readonly SavedView[]> {
    const response = await requestJson<ViewsResponse>("/api/saved-views", {
      signal,
    });

    return response.views;
  },

  async listGames(
    viewId: string,
    search: string,
    signal?: AbortSignal,
  ): Promise<SavedViewGames> {
    const query = new URLSearchParams();

    if (search.trim().length > 0) {
      query.set("search", search.trim());
    }

    const suffix = query.size === 0 ? "" : `?${query.toString()}`;

    return requestJson<SavedViewGames>(
      `/api/saved-views/${encodeURIComponent(viewId)}/games${suffix}`,
      {
        signal,
      },
    );
  },

  async create(input: SavedViewInput): Promise<SavedView> {
    const response = await requestJson<ViewResponse>("/api/saved-views", {
      method: "POST",
      body: JSON.stringify(input),
    });

    return response.view;
  },

  async update(viewId: string, input: SavedViewInput): Promise<SavedView> {
    const response = await requestJson<ViewResponse>(
      `/api/saved-views/${encodeURIComponent(viewId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );

    return response.view;
  },

  async reorder(
    orderedViewIds: readonly string[],
  ): Promise<readonly SavedView[]> {
    const response = await requestJson<ViewsResponse>(
      "/api/saved-views/order",
      {
        method: "PUT",

        body: JSON.stringify({
          orderedViewIds,
        }),
      },
    );

    return response.views;
  },

  async delete(viewId: string): Promise<void> {
    await requestVoid(`/api/saved-views/${encodeURIComponent(viewId)}`, {
      method: "DELETE",
    });
  },
};
