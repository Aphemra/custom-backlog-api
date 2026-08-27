import type {
  CreatePlayStationTitleLinkInput,
  PlayStationConnectionStatus,
  PlayStationGameLink,
  PlayStationTitlePreview,
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

export const playStationApi = {
  async getStatus(signal?: AbortSignal): Promise<PlayStationConnectionStatus> {
    const response = await requestJson<StatusResponse>(
      "/api/integrations/playstation/status",
      { signal },
    );

    return response.status;
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
};
