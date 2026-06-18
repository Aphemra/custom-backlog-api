import { useEffect, useState } from "react";
import { getPsnProfilesIntegrationStatus, type PsnProfilesIntegrationStatus } from "../../../services/api/psnProfilesApi";

type StatusState = "checking" | "disabled" | "enabled" | "offline";

export function PsnProfilesStatusBadge() {
  const [statusState, setStatusState] = useState<StatusState>("checking");
  const [status, setStatus] = useState<PsnProfilesIntegrationStatus | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadStatus() {
      try {
        const response = await getPsnProfilesIntegrationStatus();

        if (!isMounted) {
          return;
        }

        setStatus(response);
        setStatusState(response.enabled ? "enabled" : "disabled");
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
    <div className={`psnp-status psnp-status--${statusState}`} title={status?.message ?? getFallbackTitle(statusState)}>
      <span className="psnp-status__dot" aria-hidden="true" />
      <span>{getStatusLabel(statusState)}</span>
    </div>
  );
}

function getStatusLabel(statusState: StatusState): string {
  switch (statusState) {
    case "checking":
      return "PSNP Checking";
    case "disabled":
      return "PSNP Disabled";
    case "enabled":
      return "PSNP Ready";
    case "offline":
      return "PSNP Offline";
  }
}

function getFallbackTitle(statusState: StatusState): string {
  switch (statusState) {
    case "checking":
      return "Checking PSNProfiles integration status.";
    case "disabled":
      return "PSNProfiles integration is disabled.";
    case "enabled":
      return "PSNProfiles integration is enabled.";
    case "offline":
      return "Could not reach the API server to check PSNProfiles status.";
  }
}
