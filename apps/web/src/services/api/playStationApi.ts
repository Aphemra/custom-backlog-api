import type {
  CreatePlayStationTitleImportInput,
  CreatePlayStationTitleLinkInput,
  CreatedPlayStationLibraryGame,
  PlayStationConnectionStatus,
  PlayStationGameLink,
  PlayStationProfileProgression,
  PlayStationProgressSynchronizationResponse,
  PlayStationSyncProgress,
  PlayStationTitlePreview,
  PlayStationSynchronizationResponse,
  StoredPlayStationTrophySet,
} from "../../domain/playStation";
import { requestJson } from "./apiClient";

interface StatusResponse {
  readonly status: PlayStationConnectionStatus;
}

interface PreviewResponse {
  readonly preview: PlayStationTitlePreview;
}

interface LinkResponse {
  readonly link: PlayStationGameLink;
}

interface SyncProgressResponse {
  readonly progress: PlayStationSyncProgress;
}

interface ProfileProgressionResponse {
  readonly progression: PlayStationProfileProgression | null;
}

interface TrophySetResponse {
  readonly trophySet: StoredPlayStationTrophySet;
}

export const playStationApi = {
  async getStatus(signal?: AbortSignal): Promise<PlayStationConnectionStatus> {
    const response = await requestJson<StatusResponse>(
      "/api/integrations/playstation/status",
      { signal },
    );

    return response.status;
  },

  async getSyncProgress(
    signal?: AbortSignal,
  ): Promise<PlayStationSyncProgress> {
    const response = await requestJson<SyncProgressResponse>(
      "/api/integrations/playstation/sync-progress",
      { signal },
    );

    return response.progress;
  },

  async getProfileProgression(
    signal?: AbortSignal,
  ): Promise<PlayStationProfileProgression | null> {
    const response = await requestJson<ProfileProgressionResponse>(
      "/api/integrations/playstation/profile-progression",
      { signal },
    );

    return response.progression;
  },

  async getStoredTrophySet(
    gameId: string,
    signal?: AbortSignal,
  ): Promise<StoredPlayStationTrophySet> {
    const response = await requestJson<TrophySetResponse>(
      `/api/integrations/playstation/games/${encodeURIComponent(gameId)}/trophies`,
      { signal },
    );

    return response.trophySet;
  },

  async updateTrophyAvailability(
    gameId: string,
    trophyId: number,
    unobtainable: boolean,
    reason: string | null,
  ): Promise<StoredPlayStationTrophySet> {
    const response = await requestJson<TrophySetResponse>(
      `/api/integrations/playstation/games/${encodeURIComponent(gameId)}/trophies/${trophyId}/availability`,
      {
        method: "PATCH",
        body: JSON.stringify({ unobtainable, reason }),
      },
    );

    return response.trophySet;
  },

  async previewTitles(): Promise<PlayStationTitlePreview> {
    const response = await requestJson<PreviewResponse>(
      "/api/integrations/playstation/title-previews",
      {
        method: "POST",
        headers: {
          "x-trophy-backlog-action": "preview-playstation-titles",
        },
      },
    );

    return response.preview;
  },

  async linkTitle(
    input: CreatePlayStationTitleLinkInput,
  ): Promise<PlayStationGameLink> {
    const response = await requestJson<LinkResponse>(
      "/api/integrations/playstation/title-links",
      {
        method: "POST",
        headers: {
          "x-trophy-backlog-action": "link-playstation-title",
        },
        body: JSON.stringify(input),
      },
    );

    return response.link;
  },

  async importTitle(
    input: CreatePlayStationTitleImportInput,
  ): Promise<CreatedPlayStationLibraryGame> {
    return requestJson<CreatedPlayStationLibraryGame>(
      "/api/integrations/playstation/title-imports",
      {
        method: "POST",
        headers: {
          "x-trophy-backlog-action": "import-playstation-title",
        },
        body: JSON.stringify(input),
      },
    );
  },

  async synchronizeProgress(): Promise<PlayStationProgressSynchronizationResponse> {
    return requestJson<PlayStationProgressSynchronizationResponse>(
      "/api/integrations/playstation/progress-syncs",
      {
        method: "POST",
        headers: {
          "x-trophy-backlog-action": "synchronize-playstation-trophy-progress",
        },
      },
    );
  },

  async synchronize(): Promise<PlayStationSynchronizationResponse> {
    return requestJson<PlayStationSynchronizationResponse>(
      "/api/integrations/playstation/syncs",
      {
        method: "POST",
        headers: {
          "x-trophy-backlog-action": "synchronize-playstation-trophies",
        },
      },
    );
  },
};
