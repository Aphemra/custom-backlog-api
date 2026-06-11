export function BacklogControls() {
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
      </div>
    </section>
  );
}
