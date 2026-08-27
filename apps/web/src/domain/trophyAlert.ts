import type { PlayStationPlatform } from "./libraryGame";

export type TrophyAlertKind = "new_trophies" | "completion_lost";

export type TrophyAlertStatus = "unread" | "read" | "resolved" | "dismissed";

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

export interface TrophyAlertAddedTrophy {
  readonly trophyId: number;
  readonly trophyGroupId: string;
  readonly trophyGroupName: string;
  readonly trophyType: "bronze" | "silver" | "gold" | "platinum";
  readonly name: string | null;
  readonly detail: string | null;
  readonly iconUrl: string | null;
  readonly iconImageId: string | null;
}

export interface TrophyAlertAffectedGroup {
  readonly trophyGroupId: string;
  readonly name: string;
  readonly addedTrophyCount: number;
}

export interface TrophyAlertTrophySetChange {
  readonly detailStatus: "exact" | "summary_only";
  readonly addedTrophies: readonly TrophyAlertAddedTrophy[];
  readonly affectedGroups: readonly TrophyAlertAffectedGroup[];
}

export interface NewTrophiesAlertDetails {
  readonly title: string;
  readonly previousTotals: TrophyAlertTrophyCounts;
  readonly currentTotals: TrophyAlertTrophyCounts;
  readonly previousTotalCount: number;
  readonly currentTotalCount: number;
  readonly trophySetChange: TrophyAlertTrophySetChange | null;
}

export interface CompletionLostAlertDetails {
  readonly title: string;
  readonly previousProgress: number;
  readonly currentProgress: number;
  readonly previousEarned: TrophyAlertTrophyCounts;
  readonly currentEarned: TrophyAlertTrophyCounts;
  readonly trophySetChange: TrophyAlertTrophySetChange | null;
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

export interface TrophyAlertFilters {
  readonly kind?: TrophyAlertKind;
  readonly status?: TrophyAlertStatus;
}
