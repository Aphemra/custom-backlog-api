import { LibraryPage } from "../features/library/pages/LibraryPage";

export function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Local-first PlayStation trophy tracker</p>
          <h1>Trophy Backlog</h1>
        </div>

        <span className="status-pill">Local database</span>
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

      <LibraryPage />
    </main>
  );
}
