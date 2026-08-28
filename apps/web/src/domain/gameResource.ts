export const gameResourceTypes = [
  "trophy_page",
  "guide",
  "interactive_map",
] as const;

export type GameResourceType = (typeof gameResourceTypes)[number];

export const gameResourceTypeLabels: Readonly<
  Record<GameResourceType, string>
> = {
  trophy_page: "Trophy page",
  guide: "Guide",
  interactive_map: "Interactive map",
};

export type GameResourceProvider =
  | "psnprofiles"
  | "powerpyx"
  | "mapgenie"
  | "other";

export const gameResourceProviderLabels: Readonly<
  Record<GameResourceProvider, string>
> = {
  psnprofiles: "PSNProfiles",
  powerpyx: "PowerPyx",
  mapgenie: "MapGenie",
  other: "Other",
};

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
