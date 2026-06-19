import { useState } from "react";
import { AddGamePanel } from "../components/AddGamePanel";
import { BacklogControls } from "../components/BacklogControls";
import { BacklogHeader } from "../components/BacklogHeader";
import { BacklogList } from "../components/BacklogList";
import { BacklogStatsStrip } from "../components/BacklogStatsStrip";
import { BucketPanel } from "../components/BucketPanel";
import { ImportExportView } from "../components/ImportExportView";
import { InfoSettingsView } from "../components/InfoSettingsView";
import { calculateBacklogStats } from "../services/calculateBacklogStats";
import { filterBacklogEntries } from "../services/filterBacklogEntries";
import { useBacklogStore } from "../store/useBacklogStore";
import { sortBacklogEntries } from "../services/sortBacklogEntries";

const workspaceViews = ["add-game", "backlog", "buckets", "import-export", "info-settings"] as const;

type WorkspaceView = (typeof workspaceViews)[number];

const navigationItems: {
  view: Exclude<WorkspaceView, "add-game">;
  label: string;
}[] = [
  { view: "backlog", label: "Backlog" },
  { view: "buckets", label: "Buckets" },
  { view: "import-export", label: "Import / Export" },
  { view: "info-settings", label: "Info & Settings" },
];

export function BacklogPage() {
  const [activeView, setActiveView] = useState<WorkspaceView>("backlog");

  const gameEntries = useBacklogStore((state) => state.gameEntries);
  const buckets = useBacklogStore((state) => state.buckets);
  const selectedGameEntryId = useBacklogStore((state) => state.selectedGameEntryId);
  const filters = useBacklogStore((state) => state.filters);
  const selectGameEntry = useBacklogStore((state) => state.selectGameEntry);

  const backlogStats = calculateBacklogStats(gameEntries);
  const filteredGameEntries = filterBacklogEntries(gameEntries, filters);
  const sortedGameEntries = sortBacklogEntries(filteredGameEntries, filters.sortMode);

  const activeViewIndex = workspaceViews.indexOf(activeView);

  return (
    <main className="app-shell">
      <section className="backlog-page">
        <div className="backlog-page__top">
          <BacklogHeader />
          <BacklogStatsStrip stats={backlogStats} />

          <WorkspaceNavigation activeView={activeView} onSelectView={setActiveView} />
        </div>

        <div className="workspace-slider">
          <div className="workspace-slider__track" style={{ transform: `translateX(-${activeViewIndex * 100}%)` }}>
            <section className="workspace-slider__panel" aria-label="Add game view">
              <AddGamePanel onCancel={() => setActiveView("backlog")} onSaved={() => setActiveView("backlog")} />
            </section>

            <section className="workspace-slider__panel" aria-label="Backlog view">
              <div className="workspace-view-stack">
                <BacklogControls />
                <BacklogList games={sortedGameEntries} buckets={buckets} selectedGameEntryId={selectedGameEntryId} onSelectGame={selectGameEntry} />
              </div>
            </section>

            <section className="workspace-slider__panel" aria-label="Buckets view">
              <BucketPanel onClose={() => setActiveView("backlog")} />
            </section>

            <section className="workspace-slider__panel" aria-label="Import and export view">
              <ImportExportView />
            </section>

            <section className="workspace-slider__panel" aria-label="Info and settings view">
              <InfoSettingsView />
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}

interface WorkspaceNavigationProps {
  activeView: WorkspaceView;
  onSelectView: (view: WorkspaceView) => void;
}

function WorkspaceNavigation({ activeView, onSelectView }: WorkspaceNavigationProps) {
  return (
    <nav className="workspace-nav" aria-label="Workspace navigation">
      <div className="workspace-nav__tabs">
        {navigationItems.map((item) => (
          <button
            className={`workspace-nav__tab ${activeView === item.view ? "workspace-nav__tab--active" : ""}`}
            type="button"
            onClick={() => onSelectView(item.view)}
            key={item.view}
          >
            {item.label}
          </button>
        ))}
      </div>

      <button
        className={`button button--primary workspace-nav__add ${activeView === "add-game" ? "workspace-nav__add--active" : ""}`}
        type="button"
        onClick={() => onSelectView("add-game")}
      >
        + Add Game
      </button>
    </nav>
  );
}
