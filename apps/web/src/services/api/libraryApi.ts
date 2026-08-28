import type {
  CreateLibraryGameInput,
  LibraryGameListItem,
  LibraryGameWithArtwork,
  UpdateLibraryGameInput,
} from "../../domain/libraryGame";
import type { LibraryGameDetails } from "../../domain/libraryGameDetails";
import { requestJson, requestVoid } from "./apiClient";

interface GameResponse {
  readonly game: LibraryGameWithArtwork;
}

interface GamesResponse {
  readonly games: readonly LibraryGameListItem[];
}

interface GameDetailsResponse {
  readonly details: LibraryGameDetails;
}

export const libraryApi = {
  async list(signal?: AbortSignal): Promise<readonly LibraryGameListItem[]> {
    const response = await requestJson<GamesResponse>(
      "/api/library/games?includeHidden=true",
      { signal },
    );

    return response.games;
  },

  async getDetails(
    gameId: string,
    signal?: AbortSignal,
  ): Promise<LibraryGameDetails> {
    const response = await requestJson<GameDetailsResponse>(
      `/api/library/games/${encodeURIComponent(gameId)}/details`,
      { signal },
    );

    return response.details;
  },

  async create(input: CreateLibraryGameInput): Promise<LibraryGameWithArtwork> {
    const response = await requestJson<GameResponse>("/api/library/games", {
      method: "POST",
      body: JSON.stringify(input),
    });

    return response.game;
  },

  async update(
    gameId: string,
    input: UpdateLibraryGameInput,
  ): Promise<LibraryGameWithArtwork> {
    const response = await requestJson<GameResponse>(
      `/api/library/games/${encodeURIComponent(gameId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );

    return response.game;
  },

  async reorder(
    orderedGameIds: readonly string[],
  ): Promise<readonly LibraryGameListItem[]> {
    const response = await requestJson<GamesResponse>(
      "/api/library/games/order",
      {
        method: "PUT",
        body: JSON.stringify({ orderedGameIds }),
      },
    );

    return response.games;
  },

  async hide(gameId: string): Promise<LibraryGameWithArtwork> {
    const response = await requestJson<GameResponse>(
      `/api/library/games/${encodeURIComponent(gameId)}/hide`,
      { method: "POST" },
    );

    return response.game;
  },

  async unhide(gameId: string): Promise<LibraryGameWithArtwork> {
    const response = await requestJson<GameResponse>(
      `/api/library/games/${encodeURIComponent(gameId)}/unhide`,
      { method: "POST" },
    );

    return response.game;
  },

  async deletePermanently(gameId: string): Promise<void> {
    await requestVoid(`/api/library/games/${encodeURIComponent(gameId)}`, {
      method: "DELETE",
    });
  },
};
