import type {
  CreateLibraryGameInput,
  LibraryGame,
  UpdateLibraryGameInput,
} from "../../domain/libraryGame";
import { requestJson, requestVoid } from "./apiClient";

interface GameResponse {
  readonly game: LibraryGame;
}

interface GamesResponse {
  readonly games: readonly LibraryGame[];
}

export const libraryApi = {
  async list(signal?: AbortSignal): Promise<readonly LibraryGame[]> {
    const response = await requestJson<GamesResponse>(
      "/api/library/games?includeArchived=true",
      { signal },
    );

    return response.games;
  },

  async create(input: CreateLibraryGameInput): Promise<LibraryGame> {
    const response = await requestJson<GameResponse>("/api/library/games", {
      method: "POST",
      body: JSON.stringify(input),
    });

    return response.game;
  },

  async update(
    gameId: string,
    input: UpdateLibraryGameInput,
  ): Promise<LibraryGame> {
    const response = await requestJson<GameResponse>(
      `/api/library/games/${encodeURIComponent(gameId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );

    return response.game;
  },

  async reorder(orderedGameIds: readonly string[]): Promise<readonly LibraryGame[]> {
    const response = await requestJson<GamesResponse>("/api/library/games/order", {
      method: "PUT",
      body: JSON.stringify({ orderedGameIds }),
    });

    return response.games;
  },

  async archive(gameId: string): Promise<LibraryGame> {
    const response = await requestJson<GameResponse>(
      `/api/library/games/${encodeURIComponent(gameId)}/archive`,
      { method: "POST" },
    );

    return response.game;
  },

  async restore(gameId: string): Promise<LibraryGame> {
    const response = await requestJson<GameResponse>(
      `/api/library/games/${encodeURIComponent(gameId)}/restore`,
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
