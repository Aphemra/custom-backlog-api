import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PlayStationProfileProgression } from "../../domain/playStation";
import { playStationApi } from "../../services/api/playStationApi";
import {
  ProfileProgressionContext,
  type ProfileProgressionLoadState,
} from "./profileProgressionContext";

interface ProfileProgressionProviderProps {
  readonly children: ReactNode;
}

export function ProfileProgressionProvider({
  children,
}: ProfileProgressionProviderProps) {
  const [progression, setProgression] =
    useState<PlayStationProfileProgression | null>(null);

  const [loadState, setLoadState] =
    useState<ProfileProgressionLoadState>("loading");

  useEffect(() => {
    const controller = new AbortController();

    void playStationApi
      .getProfileProgression(controller.signal)
      .then((loadedProgression) => {
        if (!controller.signal.aborted) {
          setProgression(loadedProgression);
          setLoadState("ready");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoadState("error");
        }
      });

    return () => {
      controller.abort();
    };
  }, []);

  const refreshProfileProgression = useCallback(async (): Promise<void> => {
    try {
      const loadedProgression = await playStationApi.getProfileProgression();

      setProgression(loadedProgression);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, []);

  const contextValue = useMemo(
    () => ({
      progression,
      loadState,
      refreshProfileProgression,
    }),
    [loadState, progression, refreshProfileProgression],
  );

  return (
    <ProfileProgressionContext.Provider value={contextValue}>
      {children}
    </ProfileProgressionContext.Provider>
  );
}
