import { create } from "zustand";
import { mockBacklog, mockBuckets, mockGameEntries, mockUser } from "../../../data/mock/mockBacklogData";
import type { Backlog, Bucket, GameEntry, User } from "../../../domain/backlog";

interface BacklogState {
  user: User;
  backlog: Backlog;
  gameEntries: GameEntry[];
  buckets: Bucket[];

  selectedGameEntryId: string | null;

  selectGameEntry: (gameEntryId: string) => void;
  closeSelectedGameEntry: () => void;
}

export const useBacklogStore = create<BacklogState>((set) => ({
  user: mockUser,
  backlog: mockBacklog,
  gameEntries: mockGameEntries,
  buckets: mockBuckets,

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
}));
