import { createContext } from "react";
import type { PlayStationProfileProgression } from "../../domain/playStation";

export type ProfileProgressionLoadState = "loading" | "ready" | "error";

export interface ProfileProgressionContextValue {
  readonly progression: PlayStationProfileProgression | null;
  readonly loadState: ProfileProgressionLoadState;
  readonly refreshProfileProgression: () => Promise<void>;
}

export const ProfileProgressionContext =
  createContext<ProfileProgressionContextValue | null>(null);
