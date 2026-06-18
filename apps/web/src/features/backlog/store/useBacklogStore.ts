import { create } from "zustand";
import { persist } from "zustand/middleware";
import { applyGameBucketMembership } from "../services/applyGameBucketMembership";
import { moveGameEntryInPriorityOrder, type PriorityMoveDirection } from "../services/moveGameEntryInPriorityOrder";
import { mockBacklog, mockBuckets, mockGameEntries, mockUser } from "../../../data/mock/mockBacklogData";
import type { Backlog, Bucket, GameEntry, PlayStatus, User } from "../../../domain/backlog";
import type { PlatformId } from "../../../domain/platform";
import type { TrophyProgress, TrophyStatus } from "../../../domain/trophy";
import type { BacklogBackup } from "../../importExport/types/backup";
import type { BacklogFilters, BacklogRatingFilter, BacklogSortMode, BacklogStatusFilter } from "../types/backlogFilters";
import type { GameExternalMetadata } from "../../../domain/externalMetadata";
import { normalizeTrophyProgress } from "../services/trophyProgressHelpers";
import type { PsnProfilesImportResult } from "../../psnProfilesImport/types/psnProfilesImport";

export type GameEntryUpdate = Partial<
  Pick<
    GameEntry,
    "title" | "sortTitle" | "externalMetadata" | "platformIds" | "playStatus" | "trophyStatus" | "priorityOrder" | "bucketIds" | "notes" | "rating"
  >
> & {
  trophyProgress?: Partial<GameEntry["trophyProgress"]>;
};

export interface CreateGameEntryInput {
  title: string;
  platformIds: PlatformId[];
  playStatus: PlayStatus;
  trophyStatus: TrophyStatus;
  trophyProgress: TrophyProgress;
  bucketIds: string[];
  externalMetadata?: GameExternalMetadata;
  notes?: string;
  rating?: number;
}

interface BacklogState {
  user: User;
  backlog: Backlog;
  gameEntries: GameEntry[];
  buckets: Bucket[];

  selectedGameEntryId: string | null;
  isAddGamePanelOpen: boolean;
  isBucketPanelOpen: boolean;
  filters: BacklogFilters;

  isPsnProfilesImportPanelOpen: boolean;
  pendingPsnProfilesImportResult: PsnProfilesImportResult | null;

  selectGameEntry: (gameEntryId: string) => void;
  closeSelectedGameEntry: () => void;

  openAddGamePanel: () => void;
  closeAddGamePanel: () => void;

  toggleBucketPanel: () => void;
  closeBucketPanel: () => void;

  setSearchText: (searchText: string) => void;
  setStatusFilter: (statusFilter: BacklogStatusFilter) => void;
  setRatingFilter: (ratingFilter: BacklogRatingFilter) => void;
  setBucketFilter: (bucketId: string | null) => void;
  setSortMode: (sortMode: BacklogSortMode) => void;
  clearFilters: () => void;

  createBucket: (name: string) => void;
  renameBucket: (bucketId: string, name: string) => void;
  deleteBucket: (bucketId: string) => void;

  openPsnProfilesImportPanel: (importResult?: PsnProfilesImportResult) => void;
  togglePsnProfilesImportPanel: () => void;
  closePsnProfilesImportPanel: () => void;

  addGameEntry: (input: CreateGameEntryInput) => void;
  updateGameEntry: (gameEntryId: string, updates: GameEntryUpdate) => void;
  moveGameEntry: (gameEntryId: string, direction: PriorityMoveDirection) => void;
  deleteGameEntry: (gameEntryId: string) => void;

  replaceBacklogData: (backup: BacklogBackup) => void;
  resetBacklogData: () => void;
}

const initialBacklogData = {
  user: mockUser,
  backlog: mockBacklog,
  gameEntries: mockGameEntries,
  buckets: mockBuckets,
};

const initialFilters: BacklogFilters = {
  searchText: "",
  statusFilter: "all",
  ratingFilter: "all",
  bucketId: null,
  sortMode: "priority",
};

export const useBacklogStore = create<BacklogState>()(
  persist(
    (set, get) => ({
      ...initialBacklogData,

      selectedGameEntryId: null,
      isAddGamePanelOpen: false,
      isBucketPanelOpen: false,
      filters: initialFilters,
      isPsnProfilesImportPanelOpen: false,
      pendingPsnProfilesImportResult: null,

      selectGameEntry: (gameEntryId) => {
        set((state) => ({
          selectedGameEntryId: state.selectedGameEntryId === gameEntryId ? null : gameEntryId,
        }));
      },

      closeSelectedGameEntry: () => {
        set({
          selectedGameEntryId: null,
        });
      },

      openAddGamePanel: () => {
        set({
          isAddGamePanelOpen: true,
          selectedGameEntryId: null,
        });
      },

      closeAddGamePanel: () => {
        set({
          isAddGamePanelOpen: false,
        });
      },

      toggleBucketPanel: () => {
        set((state) => ({
          isBucketPanelOpen: !state.isBucketPanelOpen,
        }));
      },

      closeBucketPanel: () => {
        set({
          isBucketPanelOpen: false,
        });
      },

      setSearchText: (searchText) => {
        set({
          filters: {
            ...get().filters,
            searchText,
          },
        });
      },

      setStatusFilter: (statusFilter) => {
        set({
          filters: {
            ...get().filters,
            statusFilter,
          },
          selectedGameEntryId: null,
        });
      },

      setRatingFilter: (ratingFilter) => {
        set({
          filters: {
            ...get().filters,
            ratingFilter,
          },
          selectedGameEntryId: null,
        });
      },

      setBucketFilter: (bucketId) => {
        set({
          filters: {
            ...get().filters,
            bucketId,
          },
          selectedGameEntryId: null,
        });
      },

      setSortMode: (sortMode) => {
        set({
          filters: {
            ...get().filters,
            sortMode,
          },
          selectedGameEntryId: null,
        });
      },

      clearFilters: () => {
        set({
          filters: initialFilters,
          selectedGameEntryId: null,
        });
      },

      openPsnProfilesImportPanel: (importResult) => {
        set({
          isPsnProfilesImportPanelOpen: true,
          pendingPsnProfilesImportResult: importResult ?? null,
          isAddGamePanelOpen: false,
          selectedGameEntryId: null,
        });
      },

      togglePsnProfilesImportPanel: () => {
        set((state) => ({
          isPsnProfilesImportPanelOpen: !state.isPsnProfilesImportPanelOpen,
          pendingPsnProfilesImportResult: null,
          isAddGamePanelOpen: false,
          selectedGameEntryId: null,
        }));
      },

      closePsnProfilesImportPanel: () => {
        set({
          isPsnProfilesImportPanelOpen: false,
          pendingPsnProfilesImportResult: null,
        });
      },

      createBucket: (name) => {
        const trimmedName = name.trim();

        if (!trimmedName) {
          return;
        }

        const state = get();
        const now = new Date().toISOString();

        const nextBucketOrder = state.buckets.length > 0 ? Math.max(...state.buckets.map((bucket) => bucket.order)) + 1 : 1;

        const newBucket: Bucket = {
          id: createBucketId(),
          userId: state.user.id,
          backlogId: state.backlog.id,
          name: trimmedName,
          order: nextBucketOrder,
          gameOrder: [],
          createdAt: now,
          updatedAt: now,
        };

        set((currentState) => ({
          buckets: [...currentState.buckets, newBucket],
          filters: {
            ...currentState.filters,
            bucketId: newBucket.id,
          },
        }));
      },

      renameBucket: (bucketId, name) => {
        const trimmedName = name.trim();

        if (!trimmedName) {
          return;
        }

        set((state) => ({
          buckets: state.buckets.map((bucket) =>
            bucket.id === bucketId
              ? {
                  ...bucket,
                  name: trimmedName,
                  updatedAt: new Date().toISOString(),
                }
              : bucket,
          ),
        }));
      },

      deleteBucket: (bucketId) => {
        set((state) => ({
          buckets: state.buckets.filter((bucket) => bucket.id !== bucketId),

          gameEntries: state.gameEntries.map((gameEntry) => ({
            ...gameEntry,
            bucketIds: gameEntry.bucketIds.filter((currentBucketId) => currentBucketId !== bucketId),
            updatedAt: gameEntry.bucketIds.includes(bucketId) ? new Date().toISOString() : gameEntry.updatedAt,
          })),

          filters: {
            ...state.filters,
            bucketId: state.filters.bucketId === bucketId ? null : state.filters.bucketId,
          },

          selectedGameEntryId: null,
        }));
      },

      addGameEntry: (input) => {
        const state = get();
        const now = new Date().toISOString();

        const nextPriorityOrder = state.gameEntries.length > 0 ? Math.max(...state.gameEntries.map((gameEntry) => gameEntry.priorityOrder)) + 1 : 1;

        const newGameEntry: GameEntry = {
          id: createGameEntryId(),
          userId: state.user.id,
          backlogId: state.backlog.id,

          title: input.title,
          ...(input.externalMetadata ? { externalMetadata: input.externalMetadata } : {}),
          platformIds: input.platformIds,

          playStatus: input.playStatus,
          trophyStatus: input.trophyStatus,
          trophyProgress: normalizeTrophyProgress(input.trophyProgress),

          priorityOrder: nextPriorityOrder,
          bucketIds: input.bucketIds,

          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(input.rating !== undefined ? { rating: input.rating } : {}),

          createdAt: now,
          updatedAt: now,
        };

        set((currentState) => ({
          gameEntries: [...currentState.gameEntries, newGameEntry],
          buckets: applyGameBucketMembership({
            buckets: currentState.buckets,
            gameEntryId: newGameEntry.id,
            nextBucketIds: newGameEntry.bucketIds,
            updatedAt: now,
          }),
          selectedGameEntryId: newGameEntry.id,
          isAddGamePanelOpen: false,
        }));
      },

      updateGameEntry: (gameEntryId, updates) => {
        const now = new Date().toISOString();

        set((state) => {
          const updatedGameEntries = state.gameEntries.map((gameEntry) => {
            if (gameEntry.id !== gameEntryId) {
              return gameEntry;
            }

            const { trophyProgress, ...gameEntryUpdates } = updates;

            const nextTrophyProgress =
              trophyProgress !== undefined
                ? normalizeTrophyProgress({
                    ...gameEntry.trophyProgress,
                    ...trophyProgress,
                  })
                : normalizeTrophyProgress(gameEntry.trophyProgress);

            return {
              ...gameEntry,
              ...gameEntryUpdates,
              trophyProgress: nextTrophyProgress,
              updatedAt: now,
            };
          });

          const updatedGameEntry = updatedGameEntries.find((gameEntry) => gameEntry.id === gameEntryId);

          return {
            gameEntries: updatedGameEntries,
            buckets:
              updatedGameEntry && updates.bucketIds !== undefined
                ? applyGameBucketMembership({
                    buckets: state.buckets,
                    gameEntryId,
                    nextBucketIds: updatedGameEntry.bucketIds,
                    updatedAt: now,
                  })
                : state.buckets,
          };
        });
      },

      moveGameEntry: (gameEntryId, direction) => {
        const now = new Date().toISOString();

        set((state) => ({
          gameEntries: moveGameEntryInPriorityOrder({
            gameEntries: state.gameEntries,
            gameEntryId,
            direction,
            updatedAt: now,
          }),
        }));
      },

      deleteGameEntry: (gameEntryId) => {
        set((state) => ({
          gameEntries: state.gameEntries.filter((gameEntry) => gameEntry.id !== gameEntryId),

          buckets: state.buckets.map((bucket) => ({
            ...bucket,
            gameOrder: bucket.gameOrder.filter((orderedGameId) => orderedGameId !== gameEntryId),
            updatedAt: new Date().toISOString(),
          })),

          selectedGameEntryId: state.selectedGameEntryId === gameEntryId ? null : state.selectedGameEntryId,
        }));
      },

      replaceBacklogData: (backup) => {
        set({
          user: backup.user,
          backlog: backup.backlog,
          gameEntries: backup.gameEntries.map((gameEntry) => ({
            ...gameEntry,
            trophyProgress: normalizeTrophyProgress(gameEntry.trophyProgress),
          })),
          buckets: backup.buckets,
          selectedGameEntryId: null,
          isAddGamePanelOpen: false,
          isBucketPanelOpen: false,
          filters: initialFilters,
          isPsnProfilesImportPanelOpen: false,
          pendingPsnProfilesImportResult: null,
        });
      },

      resetBacklogData: () => {
        set({
          user: initialBacklogData.user,
          backlog: initialBacklogData.backlog,
          gameEntries: initialBacklogData.gameEntries.map((gameEntry) => ({
            ...gameEntry,
            trophyProgress: normalizeTrophyProgress(gameEntry.trophyProgress),
          })),
          buckets: initialBacklogData.buckets,
          selectedGameEntryId: null,
          isAddGamePanelOpen: false,
          isBucketPanelOpen: false,
          filters: initialFilters,
          isPsnProfilesImportPanelOpen: false,
          pendingPsnProfilesImportResult: null,
        });
      },
    }),
    {
      name: "custom-backlog-app:backlog-store",
      partialize: (state) => ({
        user: state.user,
        backlog: state.backlog,
        gameEntries: state.gameEntries,
        buckets: state.buckets,
      }),
    },
  ),
);

function createGameEntryId(): string {
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `game-${randomPart}`;
}

function createBucketId(): string {
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `bucket-${randomPart}`;
}
