import { BacklogControls } from "../components/BacklogControls";
import { BacklogHeader } from "../components/BacklogHeader";
import { BacklogList } from "../components/BacklogList";
import { BacklogStatsStrip } from "../components/BacklogStatsStrip";
import { calculateBacklogStats } from "../services/calculateBacklogStats";
import { useBacklogStore } from "../store/useBacklogStore";

export function BacklogPage() {
  const gameEntries = useBacklogStore((state) => state.gameEntries);
  const buckets = useBacklogStore((state) => state.buckets);
  const selectedGameEntryId = useBacklogStore((state) => state.selectedGameEntryId);
  const selectGameEntry = useBacklogStore((state) => state.selectGameEntry);

  const backlogStats = calculateBacklogStats(gameEntries);

  return (
    <main className="app-shell">
      <section className="backlog-page">
        <div className="backlog-page__top">
          <BacklogHeader />
          <BacklogStatsStrip stats={backlogStats} />
          <BacklogControls />
        </div>

        <BacklogList games={gameEntries} buckets={buckets} selectedGameEntryId={selectedGameEntryId} onSelectGame={selectGameEntry} />
      </section>
    </main>
  );
}
