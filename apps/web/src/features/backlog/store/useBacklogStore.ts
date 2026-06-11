import { create } from "zustand";
import { persist } from "zustand/middleware";
import { mockBacklog, mockBuckets, mockGameEntries, mockUser } from "../../../data/mock/mockBacklogData";
import type { Backlog, Bucket, GameEntry, PlayStatus, User } from "../../../domain/backlog";
import type { PlatformId } from "../../../domain/platform";
import type { TrophyProgress, TrophyStatus } from "../../../domain/trophy";

export type GameEntryUpdate = Partial<
  Pick<GameEntry, "title" | "sortTitle" | "platformIds" | "playStatus" | "trophyStatus" | "priorityOrder" | "bucketIds" | "notes" | "rating">
> & {
  trophyProgress?: Partial<GameEntry["trophyProgress"]>;
};

export interface CreateGameEntryInput {
  title: string;
  platformIds: PlatformId[];
  playStatus: PlayStatus;
  trophyStatus: TrophyStatus;
  trophyProgress: TrophyProgress;
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

  selectGameEntry: (gameEntryId: string) => void;
  closeSelectedGameEntry: () => void;

  openAddGamePanel: () => void;
  closeAddGamePanel: () => void;

  addGameEntry: (input: CreateGameEntryInput) => void;
  updateGameEntry: (gameEntryId: string, updates: GameEntryUpdate) => void;
  deleteGameEntry: (gameEntryId: string) => void;

  resetBacklogData: () => void;
}

const initialBacklogData = {
  user: mockUser,
  backlog: mockBacklog,
  gameEntries: mockGameEntries,
  buckets: mockBuckets,
};

export const useBacklogStore = create<BacklogState>()(
  persist(
    (set, get) => ({
      ...initialBacklogData,

      selectedGameEntryId: null,
      isAddGamePanelOpen: false,

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

      addGameEntry: (input) => {
        const state = get();
        const now = new Date().toISOString();

        const nextPriorityOrder = state.gameEntries.length > 0 ? Math.max(...state.gameEntries.map((gameEntry) => gameEntry.priorityOrder)) + 1 : 1;

        const newGameEntry: GameEntry = {
          id: createGameEntryId(),
          userId: state.user.id,
          backlogId: state.backlog.id,

          title: input.title,
          platformIds: input.platformIds,

          playStatus: input.playStatus,
          trophyStatus: input.trophyStatus,
          trophyProgress: input.trophyProgress,

          priorityOrder: nextPriorityOrder,
          bucketIds: [],

          notes: input.notes,
          rating: input.rating,

          createdAt: now,
          updatedAt: now,
        };

        set((currentState) => ({
          gameEntries: [...currentState.gameEntries, newGameEntry],
          selectedGameEntryId: newGameEntry.id,
          isAddGamePanelOpen: false,
        }));
      },

      updateGameEntry: (gameEntryId, updates) => {
        set((state) => ({
          gameEntries: state.gameEntries.map((gameEntry) => {
            if (gameEntry.id !== gameEntryId) {
              return gameEntry;
            }

            const { trophyProgress, ...gameEntryUpdates } = updates;

            return {
              ...gameEntry,
              ...gameEntryUpdates,
              trophyProgress: {
                ...gameEntry.trophyProgress,
                ...(trophyProgress ?? {}),
              },
              updatedAt: new Date().toISOString(),
            };
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

      resetBacklogData: () => {
        set({
          ...initialBacklogData,
          selectedGameEntryId: null,
          isAddGamePanelOpen: false,
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
