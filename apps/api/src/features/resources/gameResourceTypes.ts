export const gameResourceTypes = [
  "trophy_page",
  "guide",
  "interactive_map",
] as const;

export type GameResourceType = (typeof gameResourceTypes)[number];

export const gameResourceProviders = [
  "psnprofiles",
  "powerpyx",
  "mapgenie",
  "other",
] as const;

export type GameResourceProvider = (typeof gameResourceProviders)[number];

export interface GameResource {
  readonly id: string;
  readonly gameId: string;
  readonly resourceType: GameResourceType;
  readonly provider: GameResourceProvider;
  readonly url: string;
  readonly label: string | null;
  readonly sortOrder: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateGameResourceInput {
  readonly resourceType: GameResourceType;
  readonly url: string;
  readonly label?: string | null;
}

export interface UpdateGameResourceInput {
  readonly resourceType?: GameResourceType;
  readonly url?: string;
  readonly label?: string | null;
}

export interface ReplaceGameResourceOrderInput {
  readonly orderedResourceIds: readonly string[];
}
