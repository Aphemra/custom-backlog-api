import { BackendStatusBadge } from "./BackendStatusBadge";
import { IgdbIntegrationStatusBadge } from "./IgdbIntegrationStatusBadge";
import { PlatPricesStatusBadge } from "./PlatPricesStatusBadge";
import { confirmDestructiveAction } from "../services/confirmDestructiveAction";
import { useBacklogStore } from "../store/useBacklogStore";

export function InfoSettingsView() {
  const resetBacklogData = useBacklogStore((state) => state.resetBacklogData);

  function handleResetClick() {
    const confirmed = confirmDestructiveAction({
      title: "Reset backlog data?",
      detail: "This will replace your current local backlog with the default mock data.",
      confirmationText: "RESET",
    });

    if (!confirmed) {
      return;
    }

    resetBacklogData();
  }

  return (
    <section className="info-settings-view workspace-view-stack">
      <section className="details-section">
        <h3>Integration Status</h3>
        <p>Local API and external metadata provider health checks.</p>

        <div className="info-settings-view__status-list">
          <BackendStatusBadge />
          <IgdbIntegrationStatusBadge />
          <PlatPricesStatusBadge />
        </div>
      </section>

      <section className="details-section">
        <h3>Data Management</h3>
        <p>Destructive local data actions live here so they stay away from everyday backlog controls.</p>

        <div className="form-actions info-settings-view__actions">
          <button className="button button--danger" type="button" onClick={handleResetClick}>
            Reset Local Backlog Data
          </button>
        </div>
      </section>
    </section>
  );
}
