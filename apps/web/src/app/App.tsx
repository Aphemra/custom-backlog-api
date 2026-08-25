import { useState } from "react";
import { CollectionsPage } from "../features/collections/pages/CollectionsPage";
import { LibraryPage } from "../features/library/pages/LibraryPage";

type ActivePage = "library" | "collections";

export function App() {
  const [activePage, setActivePage] = useState<ActivePage>("library");

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
        <button
          className={`primary-nav__item${
            activePage === "library" ? " primary-nav__item--active" : ""
          }`}
          type="button"
          onClick={() => setActivePage("library")}
        >
          Library
        </button>

        <button
          className={`primary-nav__item${
            activePage === "collections" ? " primary-nav__item--active" : ""
          }`}
          type="button"
          onClick={() => setActivePage("collections")}
        >
          Collections
        </button>

        <span className="primary-nav__item">Alerts</span>

        <span className="primary-nav__item">Import / Export</span>

        <span className="primary-nav__item">Settings</span>
      </nav>

      {activePage === "library" ? <LibraryPage /> : <CollectionsPage />}
    </main>
  );
}
