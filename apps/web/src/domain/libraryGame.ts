export const playStationPlatforms = ["PS3", "PS4", "PS5"] as const;

export type PlayStationPlatform = (typeof playStationPlatforms)[number];

export const pursuitStatuses = [
  "unplanned",
  "pursuing_soon",
  "in_progress",
  "paused",
  "finished",
  "abandoned",
] as const;

export type PursuitStatus = (typeof pursuitStatuses)[number];

export const pursuitStatusLabels: Readonly<Record<PursuitStatus, string>> = {
  unplanned: "Unplanned",
  pursuing_soon: "Pursuing soon",
  in_progress: "In progress",
  paused: "Paused",
  finished: "Finished",
  abandoned: "Abandoned",
};

export interface LibraryGame {
  readonly id: string;
  readonly title: string;
  readonly sortTitle: string;
  readonly platform: PlayStationPlatform;
  readonly pursuitStatus: PursuitStatus;
  readonly priorityRank: number;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly archivedAt: string | null;
}

export interface CreateLibraryGameInput {
  readonly title: string;
  readonly platform: PlayStationPlatform;
  readonly pursuitStatus: PursuitStatus;
  readonly notes: string | null;
}

export type UpdateLibraryGameInput = CreateLibraryGameInput;
