import { mockBuckets, mockGameEntries } from "../../../data/mock/mockBacklogData";
import { BacklogControls } from "../components/BacklogControls";
import { BacklogHeader } from "../components/BacklogHeader";
import { BacklogList } from "../components/BacklogList";
import { BacklogStatsStrip } from "../components/BacklogStatsStrip";

export function BacklogPage() {
  return (
    <main className="app-shell">
      <section className="backlog-page">
        <div className="backlog-page__top">
          <BacklogHeader />
          <BacklogStatsStrip />
          <BacklogControls />
        </div>

        <BacklogList games={mockGameEntries} buckets={mockBuckets} />
      </section>
    </main>
  );
}
