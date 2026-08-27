import type { PlayStationPlatform } from "../library/libraryGameTypes.js";

export const trophyAlertKinds = ["new_trophies", "completion_lost"] as const;

export type TrophyAlertKind = (typeof trophyAlertKinds)[number];

export const trophyAlertStatuses = [
  "unread",
  "read",
  "resolved",
  "dismissed",
] as const;

export type TrophyAlertStatus = (typeof trophyAlertStatuses)[number];

export interface TrophyAlertCounts {
  readonly total: number;
  readonly unread: number;
  readonly unreadNewTrophies: number;
  readonly unreadCompletionLost: number;
}

export interface TrophyAlertGame {
  readonly id: string;
  readonly title: string;
  readonly platform: PlayStationPlatform;
}

export interface TrophyAlertTrophyCounts {
  readonly bronze: number;
  readonly silver: number;
  readonly gold: number;
  readonly platinum: number;
}

export interface NewTrophiesAlertDetails {
  readonly title: string;
  readonly previousTotals: TrophyAlertTrophyCounts;
  readonly currentTotals: TrophyAlertTrophyCounts;
  readonly previousTotalCount: number;
  readonly currentTotalCount: number;
}

export interface CompletionLostAlertDetails {
  readonly title: string;
  readonly previousProgress: number;
  readonly currentProgress: number;
  readonly previousEarned: TrophyAlertTrophyCounts;
  readonly currentEarned: TrophyAlertTrophyCounts;
}

interface TrophyAlertBase {
  readonly id: string;
  readonly game: TrophyAlertGame;
  readonly status: TrophyAlertStatus;
  readonly previousSnapshotId: string | null;
  readonly currentSnapshotId: string;
  readonly previousProgressPercent: number | null;
  readonly currentProgressPercent: number;
  readonly createdAt: string;
  readonly resolvedAt: string | null;
}

export type TrophyAlert =
  | (TrophyAlertBase & {
      readonly kind: "new_trophies";
      readonly details: NewTrophiesAlertDetails;
    })
  | (TrophyAlertBase & {
      readonly kind: "completion_lost";
      readonly details: CompletionLostAlertDetails;
    });

export interface TrophyAlertListFilters {
  readonly kind?: TrophyAlertKind;
  readonly status?: TrophyAlertStatus;
}
