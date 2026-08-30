import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ProfileTrophySummary } from "../components/profile/ProfileTrophySummary";
import { useProfileProgression } from "../components/profile/useProfileProgression";
import { useToast } from "../components/toast/useToast";
import { Dialog } from "../components/ui/Dialog";
import { IconButton } from "../components/ui/IconButton";
import { BackupRestoreIcon } from "../components/ui/icons";
import { TrophyAlertsPage } from "../features/alerts/pages/TrophyAlertsPage";
import { CollectionsPage } from "../features/collections/pages/CollectionsPage";
import { HistoryPage } from "../features/history/pages/HistoryPage";
import { LibraryPage } from "../features/library/pages/LibraryPage";
import { PlayStationPage } from "../features/playstation/pages/PlayStationPage";
import { PortableDataPage } from "../features/portableData/pages/PortableDataPage";
import { SettingsPage } from "../features/settings/pages/SettingsPage";
import { settingsNavigationEvent } from "../features/settings/settingsNavigation";
import { trophyAlertApi } from "../services/api/trophyAlertApi";

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
    id: "history",
    label: "History",
  },
  {
    id: "settings",
    label: "Settings",
  },
] as const;

type ActivePage = (typeof navigationItems)[number]["id"];
type PageTransitionDirection = "none" | "forward" | "backward";

export function App() {
  const { refreshProfileProgression } = useProfileProgression();
  const { showToast } = useToast();

  const [activePage, setActivePage] = useState<ActivePage>("library");
  const [pageTransitionDirection, setPageTransitionDirection] =
    useState<PageTransitionDirection>("none");
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  const [portableDataBusy, setPortableDataBusy] = useState(false);
  const [dataRevision, setDataRevision] = useState(0);
  const [unreadAlertCount, setUnreadAlertCount] = useState(0);

  const navigationPagesRef = useRef<HTMLDivElement>(null);
  const navigationButtonRefs = useRef<
    Partial<Record<ActivePage, HTMLButtonElement | null>>
  >({});

  const navigateToPage = useCallback(
    (nextPage: ActivePage): void => {
      if (nextPage === activePage) {
        return;
      }

      const currentIndex = navigationItems.findIndex(
        (item) => item.id === activePage,
      );
      const nextIndex = navigationItems.findIndex(
        (item) => item.id === nextPage,
      );

      setPageTransitionDirection(
        nextIndex > currentIndex ? "forward" : "backward",
      );
      setActivePage(nextPage);
    },
    [activePage],
  );

  useEffect(() => {
    function openSettings(): void {
      navigateToPage("settings");
    }

    window.addEventListener(settingsNavigationEvent, openSettings);

    return () => {
      window.removeEventListener(settingsNavigationEvent, openSettings);
    };
  }, [navigateToPage]);

  useLayoutEffect(() => {
    const navigationPages = navigationPagesRef.current;
    const activeButton = navigationButtonRefs.current[activePage];

    if (navigationPages === null || activeButton == null) {
      return;
    }

    const measuredNavigationPages: HTMLDivElement = navigationPages;
    const measuredActiveButton: HTMLButtonElement = activeButton;

    function updateIndicator(): void {
      measuredNavigationPages.style.setProperty(
        "--primary-nav-indicator-x",
        `${measuredActiveButton.offsetLeft}px`,
      );
      measuredNavigationPages.style.setProperty(
        "--primary-nav-indicator-y",
        `${measuredActiveButton.offsetTop}px`,
      );
      measuredNavigationPages.style.setProperty(
        "--primary-nav-indicator-width",
        `${measuredActiveButton.offsetWidth}px`,
      );
      measuredNavigationPages.style.setProperty(
        "--primary-nav-indicator-height",
        `${measuredActiveButton.offsetHeight}px`,
      );
      measuredNavigationPages.dataset.indicatorReady = "true";
    }

    updateIndicator();

    const resizeObserver = new ResizeObserver(updateIndicator);
    resizeObserver.observe(measuredNavigationPages);
    resizeObserver.observe(measuredActiveButton);

    return () => {
      resizeObserver.disconnect();
    };
  }, [activePage, unreadAlertCount]);

  const refreshUnreadAlertCount = useCallback(async (): Promise<void> => {
    const counts = await trophyAlertApi.getCounts().catch(() => null);

    if (counts !== null) {
      setUnreadAlertCount(counts.unread);
    }
  }, []);

  useEffect(() => {
    const abortController = new AbortController();

    void trophyAlertApi
      .getCounts(abortController.signal)
      .then((counts) => {
        if (!abortController.signal.aborted) {
          setUnreadAlertCount(counts.unread);
        }
      })
      .catch(() => undefined);

    return () => abortController.abort();
  }, []);

  async function handlePortableDataImported(): Promise<void> {
    setDataRevision((currentRevision) => currentRevision + 1);

    await Promise.all([
      refreshProfileProgression().catch(() => undefined),
      refreshUnreadAlertCount(),
    ]);

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
        <div className="primary-nav__pages" ref={navigationPagesRef}>
          <span className="primary-nav__indicator" aria-hidden="true" />

          {navigationItems.map((item) => {
            const isActive = activePage === item.id;
            const itemAlertCount = item.id === "alerts" ? unreadAlertCount : 0;
            const accessibleLabel =
              itemAlertCount > 0
                ? `${item.label}, ${itemAlertCount} unread`
                : item.label;

            return (
              <button
                key={item.id}
                ref={(button) => {
                  navigationButtonRefs.current[item.id] = button;
                }}
                className={`primary-nav__item${
                  isActive ? " primary-nav__item--active" : ""
                }`}
                type="button"
                aria-label={accessibleLabel}
                aria-current={isActive ? "page" : undefined}
                onClick={() => navigateToPage(item.id)}
              >
                <span>{item.label}</span>

                {itemAlertCount > 0 ? (
                  <span className="primary-nav__alert-count" aria-hidden="true">
                    {itemAlertCount > 99 ? "99+" : itemAlertCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

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

      <div
        key={activePage}
        className={`app-page app-page--${pageTransitionDirection}`}
      >
        {activePage === "library" ? (
          <LibraryPage
            key={dataRevision}
            onAlertsChanged={refreshUnreadAlertCount}
          />
        ) : null}

        {activePage === "collections" ? (
          <CollectionsPage key={dataRevision} />
        ) : null}

        {activePage === "playstation" ? (
          <PlayStationPage
            key={dataRevision}
            onAlertsChanged={refreshUnreadAlertCount}
          />
        ) : null}

        {activePage === "alerts" ? (
          <TrophyAlertsPage
            key={dataRevision}
            onUnreadCountChanged={setUnreadAlertCount}
          />
        ) : null}

        {activePage === "history" ? <HistoryPage key={dataRevision} /> : null}

        {activePage === "settings" ? (
          <SettingsPage
            key={dataRevision}
            onBacklogDeleted={() => {
              setUnreadAlertCount(0);
              navigateToPage("library");
            }}
          />
        ) : null}
      </div>

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
