import { useState } from "react";
import { CollectionsPage } from "../features/collections/pages/CollectionsPage";
import { LibraryPage } from "../features/library/pages/LibraryPage";
import { PortableDataPage } from "../features/portableData/pages/PortableDataPage";
import { SavedViewsPage } from "../features/savedViews/pages/SavedViewsPage";

type ActivePage = "library" | "collections" | "savedViews" | "portableData";

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

        <button
          className={`primary-nav__item${
            activePage === "savedViews" ? " primary-nav__item--active" : ""
          }`}
          type="button"
          onClick={() => setActivePage("savedViews")}
        >
          Saved Views
        </button>

        <span className="primary-nav__item">Alerts</span>

        <button
          className={`primary-nav__item${
            activePage === "portableData" ? " primary-nav__item--active" : ""
          }`}
          type="button"
          onClick={() => setActivePage("portableData")}
        >
          Import / Export
        </button>

        <span className="primary-nav__item">Settings</span>
      </nav>

      {activePage === "library" ? <LibraryPage /> : null}

      {activePage === "collections" ? <CollectionsPage /> : null}

      {activePage === "savedViews" ? <SavedViewsPage /> : null}

      {activePage === "portableData" ? <PortableDataPage /> : null}
    </main>
  );
}
