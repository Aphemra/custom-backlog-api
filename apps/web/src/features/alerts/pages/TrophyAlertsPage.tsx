import { useEffect, useState } from "react";
import type {
  TrophyAlert,
  TrophyAlertCounts,
  TrophyAlertFilters,
  TrophyAlertStatus,
} from "../../../domain/trophyAlert";
import { ApiError } from "../../../services/api/apiClient";
import { trophyAlertApi } from "../../../services/api/trophyAlertApi";
import { TrophyGradeIcon } from "../../../components/ui/icons";

type LoadState = "loading" | "ready" | "error";

type AlertView = "unread" | "completion_lost" | "new_trophies" | "all";

const emptyCounts: TrophyAlertCounts = {
  total: 0,
  unread: 0,
  unreadNewTrophies: 0,
  unreadCompletionLost: 0,
};

const alertViewLabels: Readonly<Record<AlertView, string>> = {
  unread: "Unread",
  completion_lost: "Completion lost",
  new_trophies: "New trophies",
  all: "All alerts",
};

const alertStatusLabels: Readonly<Record<TrophyAlertStatus, string>> = {
  unread: "Unread",
  read: "Read",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "Something unexpected went wrong while loading trophy alerts.";
}

function filtersForView(view: AlertView): TrophyAlertFilters {
  if (view === "unread") {
    return { status: "unread" };
  }

  if (view === "completion_lost") {
    return { kind: "completion_lost" };
  }

  if (view === "new_trophies") {
    return { kind: "new_trophies" };
  }

  return {};
}

function formatAlertDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function describeChange(alert: TrophyAlert): string {
  if (alert.kind === "completion_lost") {
    return (
      `Previously ${alert.details.previousProgress}% complete; ` +
      `the new snapshot is ${alert.details.currentProgress}%.`
    );
  }

  const added =
    alert.details.currentTotalCount - alert.details.previousTotalCount;

  return (
    `${alert.details.previousTotalCount} → ` +
    `${alert.details.currentTotalCount} available trophies ` +
    `(+${added}).`
  );
}

function trophyIconUrl(
  iconImageId: string | null,
  iconUrl: string | null,
): string | null {
  return iconImageId === null
    ? iconUrl
    : `/api/images/${encodeURIComponent(iconImageId)}`;
}

function TrophySetChangeDetails({ alert }: { readonly alert: TrophyAlert }) {
  const change = alert.details.trophySetChange;

  if (change === null || change.detailStatus !== "exact") {
    return null;
  }

  return (
    <div className="trophy-alert-card__details">
      {change.affectedGroups.map((group) => (
        <section key={group.trophyGroupId}>
          <h4>
            {group.name}
            <span>
              {group.addedTrophyCount} new{" "}
              {group.addedTrophyCount === 1 ? "trophy" : "trophies"}
            </span>
          </h4>

          <ul>
            {change.addedTrophies
              .filter((trophy) => trophy.trophyGroupId === group.trophyGroupId)
              .map((trophy) => {
                const imageUrl = trophyIconUrl(
                  trophy.iconImageId,
                  trophy.iconUrl,
                );

                return (
                  <li key={trophy.trophyId}>
                    {imageUrl === null ? null : (
                      <img src={imageUrl} alt="" loading="lazy" />
                    )}

                    <div>
                      <strong>
                        {trophy.name ?? `Hidden trophy #${trophy.trophyId}`}
                      </strong>

                      <TrophyGradeIcon grade={trophy.trophyType} />

                      {trophy.detail === null ? null : <p>{trophy.detail}</p>}
                    </div>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function actionNotice(alert: TrophyAlert, status: TrophyAlertStatus): string {
  if (status === "read") {
    return `${alert.game.title} was marked as read.`;
  }

  if (status === "resolved") {
    return `${alert.game.title} was marked as resolved.`;
  }

  if (status === "dismissed") {
    return `${alert.game.title} was dismissed.`;
  }

  return `${alert.game.title} was reopened.`;
}

interface TrophyAlertsPageProps {
  readonly onUnreadCountChanged: (count: number) => void;
}

export function TrophyAlertsPage({
  onUnreadCountChanged,
}: TrophyAlertsPageProps) {
  const [alerts, setAlerts] = useState<readonly TrophyAlert[]>([]);
  const [counts, setCounts] = useState<TrophyAlertCounts>(emptyCounts);
  const [activeView, setActiveView] = useState<AlertView>("unread");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [busyAlertId, setBusyAlertId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    async function loadPage(): Promise<void> {
      setLoadState("loading");
      setErrorMessage(null);

      try {
        const [loadedAlerts, loadedCounts] = await Promise.all([
          trophyAlertApi.list(
            filtersForView(activeView),
            abortController.signal,
          ),
          trophyAlertApi.getCounts(abortController.signal),
        ]);

        if (abortController.signal.aborted) {
          return;
        }

        setAlerts(loadedAlerts);
        setCounts(loadedCounts);
        onUnreadCountChanged(loadedCounts.unread);
        setLoadState("ready");
      } catch (error) {
        if (!abortController.signal.aborted) {
          setErrorMessage(getErrorMessage(error));
          setLoadState("error");
        }
      }
    }

    void loadPage();

    return () => abortController.abort();
  }, [activeView, onUnreadCountChanged]);

  async function refreshAlerts(): Promise<void> {
    const [loadedAlerts, loadedCounts] = await Promise.all([
      trophyAlertApi.list(filtersForView(activeView)),
      trophyAlertApi.getCounts(),
    ]);

    setAlerts(loadedAlerts);
    setCounts(loadedCounts);
    onUnreadCountChanged(loadedCounts.unread);
  }

  async function changeStatus(
    alert: TrophyAlert,
    status: TrophyAlertStatus,
  ): Promise<void> {
    setBusyAlertId(alert.id);
    setErrorMessage(null);
    setNotice(null);

    try {
      await trophyAlertApi.updateStatus(alert.id, status);
      await refreshAlerts();
      setNotice(actionNotice(alert, status));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyAlertId(null);
    }
  }

  function selectView(view: AlertView): void {
    setActiveView(view);
    setNotice(null);
    setErrorMessage(null);
  }

  return (
    <section className="library-page" aria-labelledby="trophy-alerts-title">
      <div className="library-heading">
        <div>
          <p className="eyebrow">Trophy changes</p>

          <h2 id="trophy-alerts-title">Alerts</h2>

          <p className="library-heading__description">
            Review newly added trophies and games that lost 100% completion.
          </p>
        </div>
      </div>

      <div className="stats-strip" aria-label="Trophy alert summary">
        <div>
          <strong>{counts.unread}</strong>
          <span>Unread alerts</span>
        </div>

        <div>
          <strong>{counts.unreadCompletionLost}</strong>
          <span>Completion lost</span>
        </div>

        <div>
          <strong>{counts.unreadNewTrophies}</strong>
          <span>New trophy sets</span>
        </div>

        <div>
          <strong>{counts.total}</strong>
          <span>Alert history</span>
        </div>
      </div>

      <div className="alert-filter-list" aria-label="Trophy alert filters">
        {(Object.keys(alertViewLabels) as AlertView[]).map((view) => (
          <button
            className={`alert-filter${
              activeView === view ? " alert-filter--active" : ""
            }`}
            type="button"
            key={view}
            aria-pressed={activeView === view}
            onClick={() => selectView(view)}
          >
            {alertViewLabels[view]}
          </button>
        ))}
      </div>

      {notice === null ? null : (
        <div className="notice notice--success" role="status">
          {notice}
        </div>
      )}

      {errorMessage === null ? null : (
        <div className="notice notice--error" role="alert">
          {errorMessage}
        </div>
      )}

      {loadState === "loading" ? (
        <div className="empty-state" role="status">
          <h3>Loading trophy alerts…</h3>
        </div>
      ) : null}

      {loadState === "error" ? (
        <div className="empty-state">
          <h3>Trophy alerts could not be loaded.</h3>

          <p>Check that the local API is running, then try again.</p>
        </div>
      ) : null}

      {loadState === "ready" && alerts.length === 0 ? (
        <div className="empty-state">
          <h3>
            {activeView === "unread"
              ? "You’re all caught up."
              : "No alerts match this filter."}
          </h3>

          <p>
            {activeView === "unread"
              ? "Future trophy-set changes will appear here after synchronization."
              : "Choose another alert filter to review the remaining history."}
          </p>
        </div>
      ) : null}

      {loadState === "ready" && alerts.length > 0 ? (
        <div className="trophy-alert-list">
          {alerts.map((alert) => {
            const busy = busyAlertId === alert.id;

            return (
              <article
                className={`trophy-alert-card trophy-alert-card--${alert.kind}`}
                key={alert.id}
              >
                <div className="trophy-alert-card__heading">
                  <div>
                    <div className="trophy-alert-card__title-line">
                      <h3>{alert.game.title}</h3>

                      <span className="platform-badge">
                        {alert.game.platform}
                      </span>

                      <span
                        className={`trophy-alert-status trophy-alert-status--${alert.status}`}
                      >
                        {alertStatusLabels[alert.status]}
                      </span>
                    </div>

                    <p className="trophy-alert-card__kind">
                      {alert.kind === "completion_lost"
                        ? "100% completion lost"
                        : "Additional trophies detected"}
                    </p>
                  </div>

                  <time dateTime={alert.createdAt}>
                    {formatAlertDate(alert.createdAt)}
                  </time>
                </div>

                <div className="trophy-alert-card__change">
                  {alert.kind === "completion_lost" ? (
                    <strong>
                      {alert.details.previousProgress}% →{" "}
                      {alert.details.currentProgress}%
                    </strong>
                  ) : (
                    <strong>
                      +{" "}
                      {alert.details.currentTotalCount -
                        alert.details.previousTotalCount}{" "}
                      trophies
                    </strong>
                  )}

                  <span>{describeChange(alert)}</span>
                </div>

                <TrophySetChangeDetails alert={alert} />

                <div className="trophy-alert-card__actions">
                  {alert.status === "unread" ? (
                    <button
                      className="text-button"
                      type="button"
                      disabled={busy}
                      onClick={() => void changeStatus(alert, "read")}
                    >
                      Mark read
                    </button>
                  ) : null}

                  {alert.kind === "completion_lost" &&
                  (alert.status === "unread" || alert.status === "read") ? (
                    <button
                      className="text-button"
                      type="button"
                      disabled={busy}
                      onClick={() => void changeStatus(alert, "resolved")}
                    >
                      Resolve
                    </button>
                  ) : null}

                  {alert.status === "unread" || alert.status === "read" ? (
                    <button
                      className="text-button text-button--danger"
                      type="button"
                      disabled={busy}
                      onClick={() => void changeStatus(alert, "dismissed")}
                    >
                      Dismiss
                    </button>
                  ) : null}

                  {alert.status === "resolved" ||
                  alert.status === "dismissed" ? (
                    <button
                      className="text-button"
                      type="button"
                      disabled={busy}
                      onClick={() => void changeStatus(alert, "unread")}
                    >
                      Reopen
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
