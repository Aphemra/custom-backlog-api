import { AddGamePanel } from "../components/AddGamePanel";
import { BacklogControls } from "../components/BacklogControls";
import { BacklogHeader } from "../components/BacklogHeader";
import { BacklogList } from "../components/BacklogList";
import { BacklogStatsStrip } from "../components/BacklogStatsStrip";
import { BucketPanel } from "../components/BucketPanel";
import { calculateBacklogStats } from "../services/calculateBacklogStats";
import { filterBacklogEntries } from "../services/filterBacklogEntries";
import { useBacklogStore } from "../store/useBacklogStore";
import { sortBacklogEntries } from "../services/sortBacklogEntries";
import { PsnProfilesImportPanel } from "../../psnProfilesImport/components/PsnProfilesImportPanel";

export function BacklogPage() {
  const gameEntries = useBacklogStore((state) => state.gameEntries);
  const buckets = useBacklogStore((state) => state.buckets);
  const selectedGameEntryId = useBacklogStore((state) => state.selectedGameEntryId);
  const isAddGamePanelOpen = useBacklogStore((state) => state.isAddGamePanelOpen);
  const isBucketPanelOpen = useBacklogStore((state) => state.isBucketPanelOpen);
  const filters = useBacklogStore((state) => state.filters);
  const selectGameEntry = useBacklogStore((state) => state.selectGameEntry);
  const isPsnProfilesImportPanelOpen = useBacklogStore((state) => state.isPsnProfilesImportPanelOpen);
  const closePsnProfilesImportPanel = useBacklogStore((state) => state.closePsnProfilesImportPanel);
  const pendingPsnProfilesImportResult = useBacklogStore((state) => state.pendingPsnProfilesImportResult);

  const backlogStats = calculateBacklogStats(gameEntries);
  const filteredGameEntries = filterBacklogEntries(gameEntries, filters);
  const sortedGameEntries = sortBacklogEntries(filteredGameEntries, filters.sortMode);

  return (
    <main className="app-shell">
      <section className="backlog-page">
        <div className="backlog-page__top">
          <BacklogHeader />
          <BacklogStatsStrip stats={backlogStats} />
          <BacklogControls />
        </div>

        {isAddGamePanelOpen ? <AddGamePanel /> : null}
        {isBucketPanelOpen ? <BucketPanel /> : null}
        {isPsnProfilesImportPanelOpen ? (
          <PsnProfilesImportPanel
            key={pendingPsnProfilesImportResult?.importedAt ?? "manual-psnprofiles-import"}
            initialImportResult={pendingPsnProfilesImportResult}
            onClose={closePsnProfilesImportPanel}
          />
        ) : null}

        <BacklogList games={sortedGameEntries} buckets={buckets} selectedGameEntryId={selectedGameEntryId} onSelectGame={selectGameEntry} />
      </section>
    </main>
  );
}
