import type { PlatformId } from "./platform";
import type { TrophyProgress, TrophyStatus } from "./trophy";

export type PlayStatus = "backlog" | "playing" | "beaten" | "completed" | "shelved" | "abandoned";

export interface User {
  id: string;
  displayName: string;
  psnProfilesUsername?: string;
}

export interface Backlog {
  id: string;
  userId: string;
  name: string;
  primaryPlatformFamily: "playstation" | "xbox" | "nintendo" | "pc" | "mixed";
  createdAt: string;
  updatedAt: string;
}

export interface Bucket {
  id: string;
  userId: string;
  backlogId: string;
  name: string;
  description?: string;
  order: number;
  gameOrder: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GameEntry {
  id: string;
  userId: string;
  backlogId: string;

  title: string;
  sortTitle?: string;

  platformIds: PlatformId[];

  playStatus: PlayStatus;
  trophyStatus: TrophyStatus;
  trophyProgress: TrophyProgress;

  priorityOrder: number;
  bucketIds: string[];

  notes?: string;
  rating?: number;

  createdAt: string;
  updatedAt: string;
}
