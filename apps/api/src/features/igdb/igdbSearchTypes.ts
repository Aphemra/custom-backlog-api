export type IgdbGameSearchResultSource = "mock" | "igdb";

export interface IgdbGameSearchResult {
  id: number;
  name: string;
  platforms: string[];
  firstReleaseYear?: number;
  coverUrl?: string;
  source: IgdbGameSearchResultSource;
}
