import { useBacklogStore } from "../store/useBacklogStore";
import { BackendStatusBadge } from "./BackendStatusBadge";
import { IgdbIntegrationStatusBadge } from "./IgdbIntegrationStatusBadge";
import { PsnProfilesStatusBadge } from "./PsnProfilesStatusBadge";

export function BacklogHeader() {
  const openAddGamePanel = useBacklogStore((state) => state.openAddGamePanel);

  return (
    <header className="backlog-header">
      <div>
        <p className="eyebrow">PlayStation Backlog</p>
        <h1>Custom Trophy Backlog</h1>
      </div>

      <div className="backlog-header__actions">
        <BackendStatusBadge />
        <IgdbIntegrationStatusBadge />
        <PsnProfilesStatusBadge />
        <button className="button button--primary" type="button" onClick={openAddGamePanel}>
          Add Game
        </button>
      </div>
    </header>
  );
}
