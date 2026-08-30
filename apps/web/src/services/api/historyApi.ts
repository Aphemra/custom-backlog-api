import type {
  BacklogHistoryFilters,
  BacklogHistoryPageResult,
  TrophyHistoryLogFilters,
  TrophyHistoryLogResult,
  TrophyHistoryMilestoneFilters,
  TrophyHistoryMilestoneResult,
  TrophyHistoryOverview,
  TrophyHistoryStatistics,
} from "../../domain/history";
import { requestJson } from "./apiClient";

function addOptionalString(
  query: URLSearchParams,
  name: string,
  value: string | undefined,
): void {
  if (value !== undefined && value.trim() !== "") {
    query.set(name, value);
  }
}

function addOptionalNumber(
  query: URLSearchParams,
  name: string,
  value: number | undefined,
): void {
  if (value !== undefined) {
    query.set(name, value.toString());
  }
}

function requestOptions(signal: AbortSignal | undefined): RequestInit {
  return signal === undefined ? {} : { signal };
}

function querySuffix(query: URLSearchParams): string {
  return query.size === 0 ? "" : `?${query.toString()}`;
}

export const historyApi = {
  getOverview(signal?: AbortSignal): Promise<TrophyHistoryOverview> {
    return requestJson<TrophyHistoryOverview>(
      "/api/history/overview",
      requestOptions(signal),
    );
  },

  getStatistics(signal?: AbortSignal): Promise<TrophyHistoryStatistics> {
    return requestJson<TrophyHistoryStatistics>(
      "/api/history/statistics",
      requestOptions(signal),
    );
  },

  listTrophies(
    filters: TrophyHistoryLogFilters = {},
    signal?: AbortSignal,
  ): Promise<TrophyHistoryLogResult> {
    const query = new URLSearchParams();

    addOptionalString(query, "search", filters.search);
    addOptionalString(query, "platform", filters.platform);
    addOptionalString(query, "trophyType", filters.trophyType);
    addOptionalString(query, "gameId", filters.gameId);
    addOptionalString(query, "earnedFrom", filters.earnedFrom);
    addOptionalString(query, "earnedTo", filters.earnedTo);
    addOptionalString(query, "direction", filters.direction);
    addOptionalNumber(query, "page", filters.page);
    addOptionalNumber(query, "pageSize", filters.pageSize);

    return requestJson<TrophyHistoryLogResult>(
      `/api/history/trophies${querySuffix(query)}`,
      requestOptions(signal),
    );
  },

  listMilestones(
    filters: TrophyHistoryMilestoneFilters = {},
    signal?: AbortSignal,
  ): Promise<TrophyHistoryMilestoneResult> {
    const query = new URLSearchParams();

    addOptionalString(query, "kind", filters.kind);
    addOptionalString(query, "direction", filters.direction);

    return requestJson<TrophyHistoryMilestoneResult>(
      `/api/history/milestones${querySuffix(query)}`,
      requestOptions(signal),
    );
  },

  listBacklogActivity(
    filters: BacklogHistoryFilters = {},
    signal?: AbortSignal,
  ): Promise<BacklogHistoryPageResult> {
    const query = new URLSearchParams();

    addOptionalString(query, "action", filters.action);
    addOptionalString(query, "source", filters.source);
    addOptionalString(query, "gameId", filters.gameId);
    addOptionalString(query, "collectionId", filters.collectionId);
    addOptionalString(query, "occurredFrom", filters.occurredFrom);
    addOptionalString(query, "occurredTo", filters.occurredTo);
    addOptionalString(query, "direction", filters.direction);
    addOptionalNumber(query, "page", filters.page);
    addOptionalNumber(query, "pageSize", filters.pageSize);

    return requestJson<BacklogHistoryPageResult>(
      `/api/history/backlog${querySuffix(query)}`,
      requestOptions(signal),
    );
  },
};
