import { useState } from "react";
import { ProfileTrophySummary } from "../components/profile/ProfileTrophySummary";
import { TrophyAlertsPage } from "../features/alerts/pages/TrophyAlertsPage";
import { CollectionsPage } from "../features/collections/pages/CollectionsPage";
import { LibraryPage } from "../features/library/pages/LibraryPage";
import { PlayStationPage } from "../features/playstation/pages/PlayStationPage";
import { SettingsPage } from "../features/settings/pages/SettingsPage";

const navigationItems = [
  {
    id: "library",
    label: "Library",
  },
  {
    id: "collections",
    label: "Collections",
  },
  {
    id: "playstation",
    label: "PSN Trophy Import",
  },
  {
    id: "alerts",
    label: "Alerts",
  },
  {
    id: "settings",
    label: "Settings",
  },
] as const;

type ActivePage = (typeof navigationItems)[number]["id"];

export function App() {
  const [activePage, setActivePage] = useState<ActivePage>("library");

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <p className="eyebrow">Personal PlayStation tracker</p>

          <h1>Trophy Backlog</h1>
        </div>

        <ProfileTrophySummary />
      </header>

      <nav className="primary-nav" aria-label="Primary navigation">
        {navigationItems.map((item) => {
          const isActive = activePage === item.id;

          return (
            <button
              key={item.id}
              className={`primary-nav__item${
                isActive ? " primary-nav__item--active" : ""
              }`}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => setActivePage(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {activePage === "library" ? <LibraryPage /> : null}

      {activePage === "collections" ? <CollectionsPage /> : null}

      {activePage === "playstation" ? <PlayStationPage /> : null}

      {activePage === "alerts" ? <TrophyAlertsPage /> : null}

      {activePage === "settings" ? (
        <SettingsPage onBacklogDeleted={() => setActivePage("library")} />
      ) : null}

      <footer className="app-footer">
        <span>Game metadata and artwork</span>

        <a href="https://www.igdb.com/" target="_blank" rel="noreferrer">
          Powered by IGDB
        </a>
      </footer>
    </main>
  );
}
