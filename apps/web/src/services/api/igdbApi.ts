import type { AddIgdbGameInput, IgdbGameSearchResult } from "../../domain/igdb";
import type { LibraryGame } from "../../domain/libraryGame";
import { requestJson } from "./apiClient";

interface SearchResponse {
  readonly games: readonly IgdbGameSearchResult[];
}

interface GameResponse {
  readonly game: LibraryGame;
}

export const igdbApi = {
  async search(
    query: string,
    includeDlc: boolean,
    signal?: AbortSignal,
  ): Promise<readonly IgdbGameSearchResult[]> {
    const response = await requestJson<SearchResponse>(
      `/api/integrations/igdb/games?query=${encodeURIComponent(query)}` +
        `&includeDlc=${includeDlc}`,
      { signal },
    );

    return response.games;
  },

  async addToLibrary(
    externalId: string,
    input: AddIgdbGameInput,
  ): Promise<LibraryGame> {
    const response = await requestJson<GameResponse>(
      `/api/integrations/igdb/games/${encodeURIComponent(externalId)}/library`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );

    return response.game;
  },
};
