const foundationItems = [
  {
    title: "Local storage",
    detail:
      "SQLite persistence, migrations, and automatic backups will replace browser localStorage.",
  },
  {
    title: "Safe trophy sync",
    detail:
      "A dedicated reader account will provide read-only trophy snapshots through a tightly constrained adapter.",
  },
  {
    title: "Trusted metadata",
    detail:
      "IGDB will provide searchable game metadata and artwork without becoming the source of trophy truth.",
  },
] as const;

export function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Local-first PlayStation trophy tracker</p>
          <h1>Trophy Backlog</h1>
        </div>

        <span className="status-pill">V2 foundation</span>
      </header>

      <nav className="primary-nav" aria-label="Primary navigation">
        <span className="primary-nav__item primary-nav__item--active">
          Library
        </span>
        <span className="primary-nav__item">Collections</span>
        <span className="primary-nav__item">Alerts</span>
        <span className="primary-nav__item">Import / Export</span>
        <span className="primary-nav__item">Settings</span>
      </nav>

      <section className="foundation-panel">
        <p className="eyebrow">Reconfiguration complete</p>
        <h2>A clean foundation for the application we actually want.</h2>
        <p className="foundation-panel__intro">
          The v1 feature code has been removed. New storage, synchronization,
          metadata, collections, saved views, and alerts will be added as
          isolated v2 features.
        </p>

        <div className="foundation-grid">
          {foundationItems.map((item) => (
            <article className="foundation-card" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
