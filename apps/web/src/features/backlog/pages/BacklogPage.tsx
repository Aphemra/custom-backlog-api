import { BacklogControls } from "../components/BacklogControls";
import { BacklogHeader } from "../components/BacklogHeader";
import { BacklogListPlaceholder } from "../components/BacklogListPlaceholder";
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

        <BacklogListPlaceholder />
      </section>
    </main>
  );
}
