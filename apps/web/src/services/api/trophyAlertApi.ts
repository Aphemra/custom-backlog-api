import type {
  TrophyAlert,
  TrophyAlertCounts,
  TrophyAlertFilters,
  TrophyAlertStatus,
} from "../../domain/trophyAlert";
import { requestJson } from "./apiClient";

interface AlertsResponse {
  readonly alerts: readonly TrophyAlert[];
}

interface AlertResponse {
  readonly alert: TrophyAlert;
}

interface AlertCountsResponse {
  readonly counts: TrophyAlertCounts;
}

export const trophyAlertApi = {
  async list(
    filters: TrophyAlertFilters = {},
    signal?: AbortSignal,
  ): Promise<readonly TrophyAlert[]> {
    const query = new URLSearchParams();

    if (filters.kind !== undefined) {
      query.set("kind", filters.kind);
    }

    if (filters.status !== undefined) {
      query.set("status", filters.status);
    }

    const suffix = query.size === 0 ? "" : `?${query.toString()}`;

    const response = await requestJson<AlertsResponse>(
      `/api/trophy-alerts${suffix}`,
      { signal },
    );

    return response.alerts;
  },

  async getCounts(signal?: AbortSignal): Promise<TrophyAlertCounts> {
    const response = await requestJson<AlertCountsResponse>(
      "/api/trophy-alerts/summary",
      { signal },
    );

    return response.counts;
  },

  async updateStatus(
    alertId: string,
    status: TrophyAlertStatus,
  ): Promise<TrophyAlert> {
    const response = await requestJson<AlertResponse>(
      `/api/trophy-alerts/${encodeURIComponent(alertId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status }),
      },
    );

    return response.alert;
  },
};
