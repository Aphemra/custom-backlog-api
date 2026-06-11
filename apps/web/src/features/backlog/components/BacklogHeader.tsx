import { useBacklogStore } from "../store/useBacklogStore";

export function BacklogHeader() {
  const openAddGamePanel = useBacklogStore((state) => state.openAddGamePanel);

  return (
    <header className="backlog-header">
      <div>
        <p className="eyebrow">PlayStation Backlog</p>
        <h1>Custom Trophy Backlog</h1>
      </div>

      <button className="button button--primary" type="button" onClick={openAddGamePanel}>
        Add Game
      </button>
    </header>
  );
}
