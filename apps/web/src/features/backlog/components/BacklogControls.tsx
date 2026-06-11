import { useBacklogStore } from "../store/useBacklogStore";

export function BacklogControls() {
  const resetBacklogData = useBacklogStore((state) => state.resetBacklogData);

  function handleResetClick() {
    const shouldReset = window.confirm("Reset the local backlog data back to the mock seed data?");

    if (shouldReset) {
      resetBacklogData();
    }
  }

  return (
    <section className="backlog-controls" aria-label="Backlog controls">
      <input className="search-input" type="search" placeholder="Search backlog..." aria-label="Search backlog" />

      <div className="control-buttons">
        <button className="button" type="button">
          Filters
        </button>

        <button className="button" type="button">
          Buckets
        </button>

        <button className="button" type="button">
          Update
        </button>

        <button className="button" type="button" onClick={handleResetClick}>
          Reset
        </button>
      </div>
    </section>
  );
}
