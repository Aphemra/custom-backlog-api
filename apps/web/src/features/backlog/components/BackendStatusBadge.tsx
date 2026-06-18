import { useEffect, useState } from "react";
import { getApiHealth } from "../../../services/api/healthApi";

type BackendStatus = "checking" | "online" | "offline";

export function BackendStatusBadge() {
  const [status, setStatus] = useState<BackendStatus>("checking");

  useEffect(() => {
    let isMounted = true;

    async function checkBackendHealth() {
      try {
        const healthResponse = await getApiHealth();

        if (!isMounted) {
          return;
        }

        setStatus(healthResponse.ok ? "online" : "offline");
      } catch {
        if (!isMounted) {
          return;
        }

        setStatus("offline");
      }
    }

    checkBackendHealth();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <span className={`backend-status backend-status--${status}`} title={getStatusTitle(status)}>
      <span className="backend-status__dot" aria-hidden="true" />
      <span>API</span>
    </span>
  );
}

function getStatusTitle(status: BackendStatus): string {
  switch (status) {
    case "checking":
      return "Checking backend API connection.";
    case "online":
      return "Backend API is reachable.";
    case "offline":
      return "Backend API is not reachable. Start the API server to use backend features.";
  }
}
