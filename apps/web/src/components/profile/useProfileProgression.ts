import { useContext } from "react";
import {
  ProfileProgressionContext,
  type ProfileProgressionContextValue,
} from "./profileProgressionContext";

export function useProfileProgression(): ProfileProgressionContextValue {
  const context = useContext(ProfileProgressionContext);

  if (context === null) {
    throw new Error(
      "useProfileProgression must be used inside ProfileProgressionProvider.",
    );
  }

  return context;
}
