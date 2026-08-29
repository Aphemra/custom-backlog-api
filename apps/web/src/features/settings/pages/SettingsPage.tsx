import { useEffect, useState, type FormEvent } from "react";
import { useToast } from "../../../components/toast/useToast";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { ExternalLinkIcon } from "../../../components/ui/icons";
import { Tooltip } from "../../../components/ui/Tooltip";
import {
  deleteEntireBacklogConfirmation,
  type BacklogDeletionResult,
} from "../../../domain/portableData";
import {
  DEFAULT_APPEARANCE_SETTINGS,
  type AppearanceSettings,
  type AppSettings,
  type PlayStationCredentialSettings,
  type UpdatePlayStationCredentialSettingsInput,
} from "../../../domain/settings";
import { ApiError } from "../../../services/api/apiClient";
import { portableDataApi } from "../../../services/api/portableDataApi";
import { settingsApi } from "../../../services/api/settingsApi";
import {
  appearanceSettingsEqual,
  applyAppearanceSettings,
  pickAppearanceSettings,
} from "../appearanceSettings";

type LoadState = "loading" | "ready" | "error";

interface AppearanceColorField {
  readonly key: keyof AppearanceSettings;
  readonly label: string;
}

const appearanceColorFields: readonly AppearanceColorField[] = [
  { key: "accentColor", label: "Interface accent" },
  { key: "notStartedColor", label: "Not started" },
  { key: "playingColor", label: "Playing" },
  { key: "onHoldColor", label: "On hold" },
  { key: "waitingColor", label: "Waiting" },
  { key: "completedColor", label: "Completed" },
  { key: "unreleasedColor", label: "Unreleased" },
  { key: "unobtainableColor", label: "Unobtainable" },
];

interface SettingsPageProps {
  readonly onBacklogDeleted: () => void;
}

const settingsDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatSettingsDate(value: string | null): string {
  return value === null
    ? "Not available"
    : settingsDateFormatter.format(new Date(value));
}

function onlineIdIsValid(value: string): boolean {
  const onlineId = value.trim();

  return (
    onlineId.length === 0 ||
    (onlineId.length >= 3 &&
      onlineId.length <= 16 &&
      /^[a-zA-Z0-9_-]+$/.test(onlineId))
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "Something unexpected went wrong while processing the request.";
}

export function SettingsPage({ onBacklogDeleted }: SettingsPageProps) {
  const { showToast, setNotificationDurationSeconds: updateToastDuration } =
    useToast();

  const [settings, setSettings] = useState<AppSettings | null>(null);

  const [playStationSettings, setPlayStationSettings] =
    useState<PlayStationCredentialSettings | null>(null);

  const [loadState, setLoadState] = useState<LoadState>("loading");

  const [cooldownEnabled, setCooldownEnabled] = useState(true);
  const [cooldownSeconds, setCooldownSeconds] = useState("300");
  const [notificationDurationSeconds, setNotificationDurationSeconds] =
    useState("5");

  const [readerOnlineId, setReaderOnlineId] = useState("");
  const [targetOnlineId, setTargetOnlineId] = useState("");
  const [npssoDraft, setNpssoDraft] = useState("");
  const [npssoFocused, setNpssoFocused] = useState(false);
  const [removeStoredNpsso, setRemoveStoredNpsso] = useState(false);
  const [renewalReminderDays, setRenewalReminderDays] = useState("7");

  const [appearance, setAppearance] = useState<AppearanceSettings>(
    DEFAULT_APPEARANCE_SETTINGS,
  );

  const [isSaving, setIsSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeletingBacklog, setIsDeletingBacklog] = useState(false);

  useEffect(() => {
    const abortController = new AbortController();

    async function loadSettings() {
      try {
        const [loadedSettings, loadedPlayStationSettings] = await Promise.all([
          settingsApi.get(abortController.signal),
          settingsApi.getPlayStation(abortController.signal),
        ]);

        if (!abortController.signal.aborted) {
          setSettings(loadedSettings);
          setPlayStationSettings(loadedPlayStationSettings);
          setCooldownEnabled(loadedSettings.trophySyncCooldownEnabled);
          setCooldownSeconds(String(loadedSettings.trophySyncCooldownSeconds));
          setNotificationDurationSeconds(
            String(loadedSettings.notificationDurationSeconds),
          );
          setAppearance(pickAppearanceSettings(loadedSettings));
          setReaderOnlineId(loadedPlayStationSettings.readerOnlineId ?? "");
          setTargetOnlineId(loadedPlayStationSettings.targetOnlineId ?? "");
          setRenewalReminderDays(
            String(loadedPlayStationSettings.renewalReminderDays),
          );
          setNpssoDraft("");
          setRemoveStoredNpsso(false);
          applyAppearanceSettings(loadedSettings);
          setLoadState("ready");
        }
      } catch {
        if (!abortController.signal.aborted) {
          setLoadState("error");
        }
      }
    }

    void loadSettings();

    return () => abortController.abort();
  }, []);

  const parsedCooldownSeconds = Number(cooldownSeconds);

  const parsedNotificationDurationSeconds = Number(notificationDurationSeconds);

  const parsedRenewalReminderDays = Number(renewalReminderDays);

  const npssoReplacement = npssoDraft.trim();

  const appSettingsAreValid =
    Number.isInteger(parsedCooldownSeconds) &&
    parsedCooldownSeconds >= 1 &&
    parsedCooldownSeconds <= 86_400 &&
    Number.isInteger(parsedNotificationDurationSeconds) &&
    parsedNotificationDurationSeconds >= 1 &&
    parsedNotificationDurationSeconds <= 60;

  const credentialSettingsAreValid =
    onlineIdIsValid(readerOnlineId) &&
    onlineIdIsValid(targetOnlineId) &&
    (npssoReplacement.length === 0 || npssoReplacement.length === 64) &&
    Number.isInteger(parsedRenewalReminderDays) &&
    parsedRenewalReminderDays >= 1 &&
    parsedRenewalReminderDays <= 30;

  const valuesAreValid = appSettingsAreValid && credentialSettingsAreValid;

  const appSettingsHaveChanges =
    settings !== null &&
    (cooldownEnabled !== settings.trophySyncCooldownEnabled ||
      parsedCooldownSeconds !== settings.trophySyncCooldownSeconds ||
      parsedNotificationDurationSeconds !==
        settings.notificationDurationSeconds ||
      !appearanceSettingsEqual(appearance, settings));

  const credentialSettingsHaveChanges =
    playStationSettings !== null &&
    ((readerOnlineId.trim() || null) !== playStationSettings.readerOnlineId ||
      (targetOnlineId.trim() || null) !== playStationSettings.targetOnlineId ||
      parsedRenewalReminderDays !== playStationSettings.renewalReminderDays ||
      npssoReplacement.length > 0 ||
      removeStoredNpsso);

  const hasChanges = appSettingsHaveChanges || credentialSettingsHaveChanges;

  function updateAppearanceColor(
    key: keyof AppearanceSettings,
    color: string,
  ): void {
    const updatedAppearance = {
      ...appearance,
      [key]: color,
    };

    setAppearance(updatedAppearance);
    applyAppearanceSettings(updatedAppearance);
  }

  function restoreDefaultAppearance(): void {
    setAppearance(DEFAULT_APPEARANCE_SETTINGS);
    applyAppearanceSettings(DEFAULT_APPEARANCE_SETTINGS);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (!valuesAreValid || settings === null || playStationSettings === null) {
      return;
    }

    setIsSaving(true);

    try {
      let updatedSettings = settings;
      let updatedPlayStationSettings = playStationSettings;

      if (appSettingsHaveChanges) {
        updatedSettings = await settingsApi.update({
          trophySyncCooldownEnabled: cooldownEnabled,
          trophySyncCooldownSeconds: parsedCooldownSeconds,
          notificationDurationSeconds: parsedNotificationDurationSeconds,
          ...appearance,
        });
      }

      if (credentialSettingsHaveChanges) {
        const credentialUpdate: UpdatePlayStationCredentialSettingsInput = {
          readerOnlineId: readerOnlineId.trim() || null,
          targetOnlineId: targetOnlineId.trim() || null,
          renewalReminderDays: parsedRenewalReminderDays,
          ...(npssoReplacement.length > 0
            ? { readerNpsso: npssoReplacement }
            : removeStoredNpsso
              ? { readerNpsso: null }
              : {}),
        };

        updatedPlayStationSettings =
          await settingsApi.updatePlayStation(credentialUpdate);
      }

      setSettings(updatedSettings);
      setPlayStationSettings(updatedPlayStationSettings);

      setCooldownEnabled(updatedSettings.trophySyncCooldownEnabled);

      setCooldownSeconds(String(updatedSettings.trophySyncCooldownSeconds));

      setNotificationDurationSeconds(
        String(updatedSettings.notificationDurationSeconds),
      );

      setReaderOnlineId(updatedPlayStationSettings.readerOnlineId ?? "");

      setTargetOnlineId(updatedPlayStationSettings.targetOnlineId ?? "");

      setRenewalReminderDays(
        String(updatedPlayStationSettings.renewalReminderDays),
      );

      setNpssoDraft("");
      setNpssoFocused(false);
      setRemoveStoredNpsso(false);

      const updatedAppearance = pickAppearanceSettings(updatedSettings);

      setAppearance(updatedAppearance);
      applyAppearanceSettings(updatedAppearance);

      updateToastDuration(updatedSettings.notificationDurationSeconds);

      showToast({
        tone: "success",
        message: "Settings were saved.",
      });
    } catch (error) {
      showToast({
        tone: "error",
        message: getErrorMessage(error),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteEntireBacklog(): Promise<void> {
    setIsDeletingBacklog(true);

    try {
      const result: BacklogDeletionResult =
        await portableDataApi.deleteEntireBacklog(
          deleteEntireBacklogConfirmation,
        );

      setDeleteDialogOpen(false);

      showToast({
        tone: "success",
        title: "Backlog deleted",
        message:
          `Deleted ${result.deleted.libraryGames} games, ` +
          `${result.deleted.collections} collections, and ` +
          `${result.deleted.savedViews} custom saved views. ` +
          `Recovery backup: ${result.backup.fileName}`,
      });

      onBacklogDeleted();
    } catch (error) {
      showToast({
        tone: "error",
        title: "Backlog was not deleted",
        message: getErrorMessage(error),
      });
    } finally {
      setIsDeletingBacklog(false);
    }
  }

  return (
    <section
      className="library-page settings-page"
      aria-labelledby="settings-title"
    >
      <div className="library-heading">
        <div>
          <p className="eyebrow">Local preferences and safety</p>

          <h2 id="settings-title">Settings</h2>

          <p className="library-heading__description">
            Configure local PlayStation access, synchronization safety,
            notification timing, and interface colors. Credentials remain on
            this computer and are never included in repository files.
          </p>
        </div>
      </div>

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
              aria-labelledby="playstation-account-settings-title"
            >
              <div className="settings-card__heading">
                <div>
                  <p className="eyebrow">Local PlayStation access</p>

                  <h3 id="playstation-account-settings-title">
                    Reader and target accounts
                  </h3>
                </div>

                <span
                  className={`status-pill${
                    playStationSettings?.hasNpsso === true && !removeStoredNpsso
                      ? ""
                      : " status-pill--warning"
                  }`}
                >
                  {playStationSettings?.hasNpsso === true && !removeStoredNpsso
                    ? "NPSSO stored"
                    : "NPSSO missing"}
                </span>
              </div>

              <p className="settings-card__description">
                The reader account performs read-only trophy requests. The
                target account is the profile whose trophies belong in this
                backlog. The NPSSO is encrypted before being stored in the local
                database.
              </p>

              <div className="settings-credential-grid">
                <label className="field">
                  <span>Reader account online ID</span>

                  <input
                    type="text"
                    minLength={3}
                    maxLength={16}
                    pattern="[a-zA-Z0-9_-]{3,16}"
                    value={readerOnlineId}
                    disabled={isSaving}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="BacklogReader"
                    onChange={(event) => setReaderOnlineId(event.target.value)}
                  />

                  <small>
                    The dedicated secondary account used to read public trophy
                    information.
                  </small>
                </label>

                <label className="field">
                  <span>Target account online ID</span>

                  <input
                    type="text"
                    minLength={3}
                    maxLength={16}
                    pattern="[a-zA-Z0-9_-]{3,16}"
                    value={targetOnlineId}
                    disabled={isSaving}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="YourPSNName"
                    onChange={(event) => setTargetOnlineId(event.target.value)}
                  />

                  <small>
                    Your actual PlayStation account whose trophies will be
                    synchronized.
                  </small>
                </label>

                <div className="field settings-credential-secret">
                  <span>Reader account NPSSO</span>

                  <div className="settings-secret-input-row">
                    <input
                      type={npssoFocused ? "text" : "password"}
                      value={npssoDraft}
                      disabled={isSaving}
                      autoComplete="new-password"
                      spellCheck={false}
                      placeholder={
                        playStationSettings?.hasNpsso === true &&
                        !removeStoredNpsso
                          ? "••••••••••••••••"
                          : "Paste the 64-character NPSSO"
                      }
                      aria-describedby="npsso-field-description"
                      onFocus={() => setNpssoFocused(true)}
                      onBlur={() => setNpssoFocused(false)}
                      onChange={(event) => {
                        setNpssoDraft(event.target.value);
                        setRemoveStoredNpsso(false);
                      }}
                    />

                    <Tooltip
                      content="Open PlayStation sign-in"
                      placement="top"
                      alignment="center"
                    >
                      <a
                        className="icon-button settings-external-link"
                        href="https://www.playstation.com/"
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open PlayStation sign-in"
                      >
                        <ExternalLinkIcon />
                      </a>
                    </Tooltip>

                    <Tooltip
                      content="Open the NPSSO cookie page"
                      placement="top"
                      alignment="end"
                    >
                      <a
                        className="icon-button settings-external-link"
                        href="https://ca.account.sony.com/api/v1/ssocookie"
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open the NPSSO cookie page"
                      >
                        <ExternalLinkIcon />
                      </a>
                    </Tooltip>
                  </div>

                  <small id="npsso-field-description">
                    Newly entered text is visible while this field is focused
                    and masked when focus leaves. The stored value is never sent
                    back to the browser.
                  </small>

                  {npssoReplacement.length > 0 &&
                  npssoReplacement.length !== 64 ? (
                    <small className="field-error">
                      NPSSO keys must contain exactly 64 characters. Current
                      length: {npssoReplacement.length}.
                    </small>
                  ) : null}

                  {playStationSettings?.hasNpsso === true ? (
                    <button
                      className="text-button settings-secret-remove"
                      type="button"
                      disabled={isSaving}
                      onClick={() => {
                        if (removeStoredNpsso) {
                          setRemoveStoredNpsso(false);
                        } else {
                          setNpssoDraft("");
                          setRemoveStoredNpsso(true);
                        }
                      }}
                    >
                      {removeStoredNpsso
                        ? "Keep stored NPSSO"
                        : "Remove stored NPSSO"}
                    </button>
                  ) : null}

                  {removeStoredNpsso ? (
                    <div className="settings-warning">
                      <strong>The stored NPSSO will be removed.</strong>

                      <span>
                        PlayStation synchronization will stop working until a
                        replacement is entered.
                      </span>
                    </div>
                  ) : null}
                </div>

                <label className="field settings-number-field">
                  <span>Renewal reminder lead time in days</span>

                  <input
                    required
                    type="number"
                    min={1}
                    max={30}
                    step={1}
                    value={renewalReminderDays}
                    disabled={isSaving}
                    onChange={(event) =>
                      setRenewalReminderDays(event.target.value)
                    }
                  />

                  <small>
                    Warn this many days before the expected NPSSO renewal date.
                  </small>
                </label>
              </div>

              <div className="settings-credential-status">
                <div>
                  <span>Last replaced</span>

                  <strong>
                    {formatSettingsDate(
                      playStationSettings?.npssoUpdatedAt ?? null,
                    )}
                  </strong>
                </div>

                <div>
                  <span>Expected renewal</span>

                  <strong>
                    {formatSettingsDate(
                      playStationSettings?.npssoExpectedRenewalAt ?? null,
                    )}
                  </strong>
                </div>
              </div>
            </section>

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

                  <small id="sync-cooldown-toggle-description">
                    Disable this only when you deliberately need unrestricted
                    manual synchronization.
                  </small>
                </span>

                <input
                  type="checkbox"
                  role="switch"
                  checked={cooldownEnabled}
                  disabled={isSaving}
                  aria-describedby="sync-cooldown-toggle-description"
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
                  aria-describedby="sync-cooldown-duration-description"
                  onChange={(event) => setCooldownSeconds(event.target.value)}
                />

                <small id="sync-cooldown-duration-description">
                  Allowed range: 1 second through 24 hours.
                </small>
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
                  aria-describedby="notification-duration-description"
                  onChange={(event) =>
                    setNotificationDurationSeconds(event.target.value)
                  }
                />

                <small id="notification-duration-description">
                  Allowed range: 1 through 60 seconds.
                </small>
              </label>

              <p className="settings-card__footnote">
                This duration applies immediately to new notifications after
                Settings are saved.
              </p>
            </section>

            <section
              className="settings-card"
              aria-labelledby="appearance-settings-title"
            >
              <div className="settings-card__heading">
                <div>
                  <p className="eyebrow">Interface appearance</p>

                  <h3 id="appearance-settings-title">
                    Accent and status colors
                  </h3>
                </div>
              </div>

              <p className="settings-card__description">
                Customize the primary interface accent and each play-status
                color while preserving the application’s dark foundation.
                Changes preview immediately and become permanent when saved.
              </p>

              <div className="settings-color-grid">
                {appearanceColorFields.map((field) => (
                  <label className="settings-color-field" key={field.key}>
                    <span>{field.label}</span>

                    <input
                      type="color"
                      value={appearance[field.key]}
                      disabled={isSaving}
                      aria-label={`${field.label} color`}
                      onChange={(event) =>
                        updateAppearanceColor(field.key, event.target.value)
                      }
                    />

                    <code>{appearance[field.key].toUpperCase()}</code>
                  </label>
                ))}
              </div>

              <button
                className="button button--quiet settings-color-reset"
                type="button"
                disabled={
                  isSaving ||
                  appearanceSettingsEqual(
                    appearance,
                    DEFAULT_APPEARANCE_SETTINGS,
                  )
                }
                onClick={restoreDefaultAppearance}
              >
                Restore default colors
              </button>
            </section>

            <section
              className="settings-card settings-card--danger"
              aria-labelledby="danger-zone-title"
            >
              <div className="settings-card__heading">
                <div>
                  <p className="eyebrow">Destructive maintenance</p>

                  <h3 id="danger-zone-title">Danger Zone</h3>
                </div>
              </div>

              <p className="settings-card__description">
                Permanently remove every Library game, Collection, and custom
                Saved View, including their game-specific trophy data, alerts,
                useful links, and PlayStation connections.
              </p>

              <p className="settings-card__footnote">
                A recovery backup is created before deletion. Settings, built-in
                Saved Views, cached artwork and metadata, and your PSN profile
                history are preserved.
              </p>

              <div className="settings-danger__action">
                <div>
                  <strong>Delete Entire Backlog</strong>

                  <small>
                    This operation cannot be undone from inside the app.
                  </small>
                </div>

                <button
                  className="button button--danger"
                  type="button"
                  disabled={isSaving || isDeletingBacklog}
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  Delete Entire Backlog
                </button>
              </div>
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

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Entire Backlog?"
        description={
          <p>
            This permanently removes all backlog games, Collections, and custom
            Saved Views.{" "}
            <strong>A recovery backup will be created first.</strong>
          </p>
        }
        confirmLabel="Delete Entire Backlog"
        requiredText={deleteEntireBacklogConfirmation}
        busy={isDeletingBacklog}
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={() => void handleDeleteEntireBacklog()}
      />
    </section>
  );
}
