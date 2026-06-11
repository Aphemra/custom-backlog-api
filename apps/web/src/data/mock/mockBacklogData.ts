import type { Backlog, Bucket, GameEntry, User } from "../../domain/backlog";

const now = new Date().toISOString();

export const mockUser: User = {
  id: "local-user",
  displayName: "Nic",
  psnProfilesUsername: "Aphemra",
};

export const mockBacklog: Backlog = {
  id: "playstation-backlog",
  userId: mockUser.id,
  name: "PlayStation Backlog",
  primaryPlatformFamily: "playstation",
  createdAt: now,
  updatedAt: now,
};

export const mockBuckets: Bucket[] = [
  {
    id: "bucket-persona",
    userId: mockUser.id,
    backlogId: mockBacklog.id,
    name: "Persona",
    order: 1,
    gameOrder: ["game-persona-3-reload"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "bucket-final-fantasy",
    userId: mockUser.id,
    backlogId: mockBacklog.id,
    name: "Final Fantasy",
    order: 2,
    gameOrder: ["game-ff7-remake"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "bucket-rgg",
    userId: mockUser.id,
    backlogId: mockBacklog.id,
    name: "RGG",
    description: "Yakuza, Like a Dragon, Judgment, and related games.",
    order: 3,
    gameOrder: ["game-yakuza-0"],
    createdAt: now,
    updatedAt: now,
  },
];

export const mockGameEntries: GameEntry[] = [
  {
    id: "game-persona-3-reload",
    userId: mockUser.id,
    backlogId: mockBacklog.id,
    title: "Persona 3 Reload",
    platformIds: ["ps5"],
    playStatus: "completed",
    trophyStatus: "platinumed",
    trophyProgress: {
      completionPercent: 100,
      earnedTrophies: 49,
      totalTrophies: 49,
      platinumEarned: true,
      psnProfilesUrl: "https://psnprofiles.com/",
    },
    priorityOrder: 1,
    bucketIds: ["bucket-persona"],
    notes: "Platinum completed. Episode Aigis DLC also finished separately.",
    rating: 9,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "game-ff7-remake",
    userId: mockUser.id,
    backlogId: mockBacklog.id,
    title: "Final Fantasy VII Remake",
    platformIds: ["ps4", "ps5"],
    playStatus: "beaten",
    trophyStatus: "cleanup",
    trophyProgress: {
      completionPercent: 72,
      earnedTrophies: 44,
      totalTrophies: 54,
      platinumEarned: false,
      psnProfilesUrl: "https://psnprofiles.com/",
    },
    priorityOrder: 2,
    bucketIds: ["bucket-final-fantasy"],
    notes: "Still needs Hard mode cleanup.",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "game-yakuza-0",
    userId: mockUser.id,
    backlogId: mockBacklog.id,
    title: "Yakuza 0",
    platformIds: ["ps4"],
    playStatus: "backlog",
    trophyStatus: "not_started",
    trophyProgress: {
      completionPercent: 0,
      earnedTrophies: 0,
      totalTrophies: 55,
      platinumEarned: false,
      psnProfilesUrl: "https://psnprofiles.com/",
    },
    priorityOrder: 3,
    bucketIds: ["bucket-rgg"],
    createdAt: now,
    updatedAt: now,
  },
];
