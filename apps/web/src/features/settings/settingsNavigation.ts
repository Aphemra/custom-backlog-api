export const settingsNavigationEvent = "trophy-backlog:navigate-to-settings";

export function requestSettingsNavigation(): void {
  window.dispatchEvent(new Event(settingsNavigationEvent));
}
