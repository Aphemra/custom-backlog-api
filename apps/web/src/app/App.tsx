import { useState } from "react";
import { ProfileTrophySummary } from "../components/profile/ProfileTrophySummary";
import { useProfileProgression } from "../components/profile/useProfileProgression";
import { useToast } from "../components/toast/useToast";
import { Dialog } from "../components/ui/Dialog";
import { IconButton } from "../components/ui/IconButton";
import { BackupRestoreIcon } from "../components/ui/icons";
import { TrophyAlertsPage } from "../features/alerts/pages/TrophyAlertsPage";
import { CollectionsPage } from "../features/collections/pages/CollectionsPage";
import { LibraryPage } from "../features/library/pages/LibraryPage";
import { PlayStationPage } from "../features/playstation/pages/PlayStationPage";
import { PortableDataPage } from "../features/portableData/pages/PortableDataPage";
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
  const { refreshProfileProgression } = useProfileProgression();
  const { showToast } = useToast();

  const [activePage, setActivePage] = useState<ActivePage>("library");
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  const [portableDataBusy, setPortableDataBusy] = useState(false);
  const [dataRevision, setDataRevision] = useState(0);

  async function handlePortableDataImported(): Promise<void> {
    setDataRevision((currentRevision) => currentRevision + 1);

    await refreshProfileProgression().catch(() => undefined);

    showToast({
      tone: "success",
      message: "The imported backlog is loaded and ready.",
    });
  }

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

        <div className="primary-nav__actions">
          <IconButton
            className="primary-nav__backup-button"
            label="Backup / Restore"
            icon={<BackupRestoreIcon />}
            tooltipPlacement="bottom"
            tooltipAlignment="end"
            onClick={() => setBackupDialogOpen(true)}
          />
        </div>
      </nav>

      {activePage === "library" ? <LibraryPage key={dataRevision} /> : null}

      {activePage === "collections" ? (
        <CollectionsPage key={dataRevision} />
      ) : null}

      {activePage === "playstation" ? (
        <PlayStationPage key={dataRevision} />
      ) : null}

      {activePage === "alerts" ? <TrophyAlertsPage key={dataRevision} /> : null}

      {activePage === "settings" ? (
        <SettingsPage
          key={dataRevision}
          onBacklogDeleted={() => setActivePage("library")}
        />
      ) : null}

      <Dialog
        open={backupDialogOpen}
        title="Backup / Restore"
        description="Download a portable copy of all local application data or safely replace it from an earlier export."
        size="large"
        dismissible={!portableDataBusy}
        onClose={() => setBackupDialogOpen(false)}
      >
        <PortableDataPage
          onImported={handlePortableDataImported}
          onImportingChange={setPortableDataBusy}
        />
      </Dialog>

      <footer className="app-footer">
        <span>Game metadata and artwork</span>

        <a href="https://www.igdb.com/" target="_blank" rel="noreferrer">
          Powered by IGDB
        </a>
      </footer>
    </main>
  );
}
