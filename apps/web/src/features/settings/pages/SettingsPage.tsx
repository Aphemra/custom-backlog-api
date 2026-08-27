import { useEffect, useState, type FormEvent } from "react";
import type { AppSettings } from "../../../domain/settings";
import { ApiError } from "../../../services/api/apiClient";
import { settingsApi } from "../../../services/api/settingsApi";

type LoadState = "loading" | "ready" | "error";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "Something unexpected went wrong while updating Settings.";
}

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  const [cooldownEnabled, setCooldownEnabled] = useState(true);
  const [cooldownSeconds, setCooldownSeconds] = useState("300");
  const [notificationDurationSeconds, setNotificationDurationSeconds] =
    useState("5");

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    async function loadSettings() {
      try {
        const loadedSettings = await settingsApi.get(abortController.signal);

        if (!abortController.signal.aborted) {
          setSettings(loadedSettings);
          setCooldownEnabled(loadedSettings.trophySyncCooldownEnabled);
          setCooldownSeconds(String(loadedSettings.trophySyncCooldownSeconds));
          setNotificationDurationSeconds(
            String(loadedSettings.notificationDurationSeconds),
          );
          setLoadState("ready");
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          setErrorMessage(getErrorMessage(error));
          setLoadState("error");
        }
      }
    }

    void loadSettings();

    return () => abortController.abort();
  }, []);

  const parsedCooldownSeconds = Number(cooldownSeconds);
  const parsedNotificationDurationSeconds = Number(notificationDurationSeconds);

  const valuesAreValid =
    Number.isInteger(parsedCooldownSeconds) &&
    parsedCooldownSeconds >= 1 &&
    parsedCooldownSeconds <= 86_400 &&
    Number.isInteger(parsedNotificationDurationSeconds) &&
    parsedNotificationDurationSeconds >= 1 &&
    parsedNotificationDurationSeconds <= 60;

  const hasChanges =
    settings !== null &&
    (cooldownEnabled !== settings.trophySyncCooldownEnabled ||
      parsedCooldownSeconds !== settings.trophySyncCooldownSeconds ||
      parsedNotificationDurationSeconds !==
        settings.notificationDurationSeconds);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (!valuesAreValid) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setNotice(null);

    try {
      const updatedSettings = await settingsApi.update({
        trophySyncCooldownEnabled: cooldownEnabled,
        trophySyncCooldownSeconds: parsedCooldownSeconds,
        notificationDurationSeconds: parsedNotificationDurationSeconds,
      });

      setSettings(updatedSettings);
      setCooldownEnabled(updatedSettings.trophySyncCooldownEnabled);
      setCooldownSeconds(String(updatedSettings.trophySyncCooldownSeconds));
      setNotificationDurationSeconds(
        String(updatedSettings.notificationDurationSeconds),
      );

      setNotice("Settings were saved.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="library-page" aria-labelledby="settings-title">
      <div className="library-heading">
        <div>
          <p className="eyebrow">Local preferences and safety</p>

          <h2 id="settings-title">Settings</h2>

          <p className="library-heading__description">
            Configure PlayStation synchronization safety and interface
            notification timing. These settings are stored only in your local
            database.
          </p>
        </div>
      </div>

      {errorMessage === null ? null : (
        <div className="notice notice--error" role="alert">
          {errorMessage}
        </div>
      )}

      {notice === null ? null : (
        <div className="notice notice--success" role="status">
          {notice}
        </div>
      )}

      {loadState === "loading" ? (
        <div className="empty-state" role="status">
          <h3>Loading Settings…</h3>

          <p>Reading your locally stored preferences.</p>
        </div>
      ) : null}

      {loadState === "error" ? (
        <div className="empty-state">
          <h3>Settings could not be loaded.</h3>

          <p>Confirm that the local API is running, then reload the page.</p>
        </div>
      ) : null}

      {loadState === "ready" ? (
        <form className="settings-form" onSubmit={handleSubmit}>
          <div className="settings-grid">
            <section
              className="settings-card"
              aria-labelledby="sync-settings-title"
            >
              <div className="settings-card__heading">
                <div>
                  <p className="eyebrow">PlayStation safety</p>

                  <h3 id="sync-settings-title">Trophy-sync cooldown</h3>
                </div>

                <span
                  className={`status-pill${
                    cooldownEnabled ? "" : " status-pill--warning"
                  }`}
                >
                  {cooldownEnabled ? "Enabled" : "Disabled"}
                </span>
              </div>

              <p className="settings-card__description">
                Prevent repeated Sync Trophy Progress requests from running too
                close together. The recommended default is 300 seconds.
              </p>

              <label className="settings-toggle">
                <span>
                  <strong>Enforce sync cooldown</strong>

                  <small>
                    Disable this only when you deliberately need unrestricted
                    manual synchronization.
                  </small>
                </span>

                <input
                  type="checkbox"
                  checked={cooldownEnabled}
                  disabled={isSaving}
                  onChange={(event) => setCooldownEnabled(event.target.checked)}
                />
              </label>

              <label className="field settings-number-field">
                <span>Cooldown duration in seconds</span>

                <input
                  required
                  type="number"
                  min={1}
                  max={86_400}
                  step={1}
                  value={cooldownSeconds}
                  disabled={!cooldownEnabled || isSaving}
                  onChange={(event) => setCooldownSeconds(event.target.value)}
                />

                <small>Allowed range: 1 second through 24 hours.</small>
              </label>

              {!cooldownEnabled ? (
                <div className="settings-warning">
                  <strong>Cooldown protection is disabled.</strong>

                  <span>
                    Provider request spacing and bounded retries remain active,
                    but full syncs may be started back-to-back.
                  </span>
                </div>
              ) : null}
            </section>

            <section
              className="settings-card"
              aria-labelledby="notification-settings-title"
            >
              <div className="settings-card__heading">
                <div>
                  <p className="eyebrow">Interface behavior</p>

                  <h3 id="notification-settings-title">Notifications</h3>
                </div>
              </div>

              <p className="settings-card__description">
                Choose how long future toast notifications remain visible before
                dismissing themselves automatically.
              </p>

              <label className="field settings-number-field">
                <span>Notification duration in seconds</span>

                <input
                  required
                  type="number"
                  min={1}
                  max={60}
                  step={1}
                  value={notificationDurationSeconds}
                  disabled={isSaving}
                  onChange={(event) =>
                    setNotificationDurationSeconds(event.target.value)
                  }
                />

                <small>Allowed range: 1 through 60 seconds.</small>
              </label>

              <p className="settings-card__footnote">
                This preference is stored now and will be consumed by the shared
                toast system during the visual-foundation checkpoint.
              </p>
            </section>
          </div>

          <div className="settings-actions">
            <span>
              {hasChanges
                ? "You have unsaved changes."
                : "All changes are saved locally."}
            </span>

            <button
              className="button button--primary"
              type="submit"
              disabled={isSaving || !hasChanges || !valuesAreValid}
            >
              {isSaving ? "Saving…" : "Save Settings"}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
