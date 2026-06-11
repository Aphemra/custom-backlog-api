import { AddGamePanel } from "../components/AddGamePanel";
import { BacklogControls } from "../components/BacklogControls";
import { BacklogHeader } from "../components/BacklogHeader";
import { BacklogList } from "../components/BacklogList";
import { BacklogStatsStrip } from "../components/BacklogStatsStrip";
import { calculateBacklogStats } from "../services/calculateBacklogStats";
import { filterBacklogEntries } from "../services/filterBacklogEntries";
import { useBacklogStore } from "../store/useBacklogStore";

export function BacklogPage() {
  const gameEntries = useBacklogStore((state) => state.gameEntries);
  const buckets = useBacklogStore((state) => state.buckets);
  const selectedGameEntryId = useBacklogStore((state) => state.selectedGameEntryId);
  const isAddGamePanelOpen = useBacklogStore((state) => state.isAddGamePanelOpen);
  const filters = useBacklogStore((state) => state.filters);
  const selectGameEntry = useBacklogStore((state) => state.selectGameEntry);

  const backlogStats = calculateBacklogStats(gameEntries);
  const filteredGameEntries = filterBacklogEntries(gameEntries, filters);

  return (
    <main className="app-shell">
      <section className="backlog-page">
        <div className="backlog-page__top">
          <BacklogHeader />
          <BacklogStatsStrip stats={backlogStats} />
          <BacklogControls />
        </div>

        {isAddGamePanelOpen ? <AddGamePanel /> : null}

        <BacklogList games={filteredGameEntries} buckets={buckets} selectedGameEntryId={selectedGameEntryId} onSelectGame={selectGameEntry} />
      </section>
    </main>
  );
}
