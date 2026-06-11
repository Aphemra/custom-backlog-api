import { create } from "zustand";
import { persist } from "zustand/middleware";
import { mockBacklog, mockBuckets, mockGameEntries, mockUser } from "../../../data/mock/mockBacklogData";
import type { Backlog, Bucket, GameEntry, User } from "../../../domain/backlog";

export type GameEntryUpdate = Partial<
  Pick<GameEntry, "title" | "sortTitle" | "platformIds" | "playStatus" | "trophyStatus" | "priorityOrder" | "bucketIds" | "notes" | "rating">
> & {
  trophyProgress?: Partial<GameEntry["trophyProgress"]>;
};

interface BacklogState {
  user: User;
  backlog: Backlog;
  gameEntries: GameEntry[];
  buckets: Bucket[];

  selectedGameEntryId: string | null;

  selectGameEntry: (gameEntryId: string) => void;
  closeSelectedGameEntry: () => void;
  updateGameEntry: (gameEntryId: string, updates: GameEntryUpdate) => void;
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
    (set) => ({
      ...initialBacklogData,

      selectedGameEntryId: null,

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

      resetBacklogData: () => {
        set({
          ...initialBacklogData,
          selectedGameEntryId: null,
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
