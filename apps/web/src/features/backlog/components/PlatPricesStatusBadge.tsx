import { useEffect, useState } from "react";
import { getPlatPricesIntegrationStatus, type PlatPricesIntegrationStatus } from "../../../services/api/platPricesApi";

type PlatPricesBadgeState = "checking" | "disabled" | "ready" | "missing_config" | "offline";

export function PlatPricesStatusBadge() {
  const [badgeState, setBadgeState] = useState<PlatPricesBadgeState>("checking");
  const [statusMessage, setStatusMessage] = useState("Checking PlatPrices integration...");

  useEffect(() => {
    let isMounted = true;

    async function loadStatus() {
      try {
        const status = await getPlatPricesIntegrationStatus();

        if (!isMounted) {
          return;
        }

        setBadgeState(getBadgeState(status));
        setStatusMessage(status.message);
      } catch {
        if (!isMounted) {
          return;
        }

        setBadgeState("offline");
        setStatusMessage("Could not reach the PlatPrices status endpoint.");
      }
    }

    void loadStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <span className={`backend-status backend-status--${badgeState}`} title={statusMessage}>
      <span className="platprices-status__dot" aria-hidden="true" />
      <span>PlatPrices</span>
    </span>
  );
}

function getBadgeState(status: PlatPricesIntegrationStatus): PlatPricesBadgeState {
  if (!status.enabled) {
    return "disabled";
  }

  if (!status.configured) {
    return "missing_config";
  }

  return "ready";
}
