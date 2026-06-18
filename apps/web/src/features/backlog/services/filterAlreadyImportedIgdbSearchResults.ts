import type { GameEntry } from "../../../domain/backlog";
import type { IgdbGameSearchResult, IgdbGameSearchResultSource } from "../../../services/api/igdbApi";

export interface FilterAlreadyImportedIgdbSearchResultsResult {
  visibleResults: IgdbGameSearchResult[];
  hiddenResults: IgdbGameSearchResult[];
}

export function filterAlreadyImportedIgdbSearchResults(
  searchResults: IgdbGameSearchResult[],
  gameEntries: GameEntry[],
): FilterAlreadyImportedIgdbSearchResultsResult {
  const hiddenResults: IgdbGameSearchResult[] = [];
  const visibleResults: IgdbGameSearchResult[] = [];

  for (const searchResult of searchResults) {
    if (isSearchResultAlreadyImported(searchResult, gameEntries)) {
      hiddenResults.push(searchResult);
    } else {
      visibleResults.push(searchResult);
    }
  }

  return {
    visibleResults,
    hiddenResults,
  };
}

function isSearchResultAlreadyImported(searchResult: IgdbGameSearchResult, gameEntries: GameEntry[]): boolean {
  return gameEntries.some((gameEntry) => {
    const igdbMetadata = gameEntry.externalMetadata?.igdb;

    if (!igdbMetadata) {
      return false;
    }

    if (igdbMetadata.igdbId !== searchResult.id) {
      return false;
    }

    if (igdbMetadata.source === searchResult.source) {
      return true;
    }

    return (
      igdbMetadata.source === undefined &&
      isLikelyLegacyMetadataMatch({
        storedName: igdbMetadata.name,
        searchName: searchResult.name,
        searchSource: searchResult.source,
      })
    );
  });
}

function isLikelyLegacyMetadataMatch({
  storedName,
  searchName,
  searchSource,
}: {
  storedName: string;
  searchName: string;
  searchSource: IgdbGameSearchResultSource;
}): boolean {
  if (searchSource !== "mock") {
    return false;
  }

  return normalizeTitle(storedName) === normalizeTitle(searchName);
}

function normalizeTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
