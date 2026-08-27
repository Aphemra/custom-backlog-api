import { useState } from "react";
import { TrophyAlertsPage } from "../features/alerts/pages/TrophyAlertsPage";
import { CollectionsPage } from "../features/collections/pages/CollectionsPage";
import { LibraryPage } from "../features/library/pages/LibraryPage";
import { PortableDataPage } from "../features/portableData/pages/PortableDataPage";
import { SavedViewsPage } from "../features/savedViews/pages/SavedViewsPage";
import { SettingsPage } from "../features/settings/pages/SettingsPage";
import { PlayStationPage } from "../features/playstation/pages/PlayStationPage";

type ActivePage =
  | "library"
  | "collections"
  | "savedViews"
  | "playstation"
  | "alerts"
  | "portableData"
  | "settings";

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

        <button
          className={`primary-nav__item${
            activePage === "playstation" ? " primary-nav__item--active" : ""
          }`}
          type="button"
          onClick={() => setActivePage("playstation")}
        >
          PlayStation
        </button>

        <button
          className={`primary-nav__item${
            activePage === "alerts" ? " primary-nav__item--active" : ""
          }`}
          type="button"
          onClick={() => setActivePage("alerts")}
        >
          Alerts
        </button>

        <button
          className={`primary-nav__item${
            activePage === "portableData" ? " primary-nav__item--active" : ""
          }`}
          type="button"
          onClick={() => setActivePage("portableData")}
        >
          Import / Export
        </button>

        <button
          className={`primary-nav__item${
            activePage === "settings" ? " primary-nav__item--active" : ""
          }`}
          type="button"
          onClick={() => setActivePage("settings")}
        >
          Settings
        </button>
      </nav>

      {activePage === "library" ? <LibraryPage /> : null}

      {activePage === "collections" ? <CollectionsPage /> : null}

      {activePage === "savedViews" ? <SavedViewsPage /> : null}

      {activePage === "playstation" ? <PlayStationPage /> : null}

      {activePage === "alerts" ? <TrophyAlertsPage /> : null}

      {activePage === "portableData" ? <PortableDataPage /> : null}

      {activePage === "settings" ? <SettingsPage /> : null}
    </main>
  );
}
