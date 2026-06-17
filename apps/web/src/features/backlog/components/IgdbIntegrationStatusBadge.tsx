import { useEffect, useState } from "react";
import { getIgdbIntegrationStatus, type IgdbIntegrationStatus } from "../../../services/api/igdbApi";

type StatusState = "checking" | "mock" | "ready" | "offline";

export function IgdbIntegrationStatusBadge() {
  const [statusState, setStatusState] = useState<StatusState>("checking");
  const [status, setStatus] = useState<IgdbIntegrationStatus | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadStatus() {
      try {
        const response = await getIgdbIntegrationStatus();

        if (!isMounted) {
          return;
        }

        setStatus(response);
        setStatusState(response.configured ? "ready" : "mock");
      } catch {
        if (!isMounted) {
          return;
        }

        setStatus(null);
        setStatusState("offline");
      }
    }

    void loadStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className={`igdb-status igdb-status--${statusState}`} title={status?.message ?? getFallbackTitle(statusState)}>
      <span className="igdb-status__dot" aria-hidden="true" />
      <span>{getStatusLabel(statusState)}</span>
    </div>
  );
}

function getStatusLabel(statusState: StatusState): string {
  switch (statusState) {
    case "checking":
      return "IGDB Checking";
    case "mock":
      return "Mock IGDB";
    case "ready":
      return "IGDB Ready";
    case "offline":
      return "IGDB Offline";
  }
}

function getFallbackTitle(statusState: StatusState): string {
  switch (statusState) {
    case "checking":
      return "Checking IGDB integration status.";
    case "mock":
      return "Mock IGDB search is active.";
    case "ready":
      return "IGDB credentials appear to be configured.";
    case "offline":
      return "Could not reach the API server to check IGDB status.";
  }
}
