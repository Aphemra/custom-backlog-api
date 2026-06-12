export interface MockIgdbGame {
  id: number;
  name: string;
  platforms: string[];
  firstReleaseYear?: number;
  coverUrl?: string;
}

export const mockIgdbGames: MockIgdbGame[] = [
  {
    id: 1,
    name: "Persona 3 Reload",
    platforms: ["PS4", "PS5"],
    firstReleaseYear: 2024,
  },
  {
    id: 2,
    name: "Persona 5 Royal",
    platforms: ["PS4", "PS5"],
    firstReleaseYear: 2019,
  },
  {
    id: 3,
    name: "Final Fantasy VII Remake",
    platforms: ["PS4", "PS5"],
    firstReleaseYear: 2020,
  },
  {
    id: 4,
    name: "Final Fantasy VII Rebirth",
    platforms: ["PS5"],
    firstReleaseYear: 2024,
  },
  {
    id: 5,
    name: "Yakuza 0",
    platforms: ["PS4"],
    firstReleaseYear: 2015,
  },
  {
    id: 6,
    name: "Like a Dragon: Infinite Wealth",
    platforms: ["PS4", "PS5"],
    firstReleaseYear: 2024,
  },
  {
    id: 7,
    name: "Metaphor: ReFantazio",
    platforms: ["PS4", "PS5"],
    firstReleaseYear: 2024,
  },
];
