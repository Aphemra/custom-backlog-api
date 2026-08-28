import type { AppearanceSettings, AppSettings } from "../../domain/settings";

const appearanceSettingKeys = [
  "accentColor",
  "notStartedColor",
  "playingColor",
  "onHoldColor",
  "waitingColor",
  "completedColor",
  "unreleasedColor",
  "unobtainableColor",
] as const;

type StatusColorKey = Exclude<keyof AppearanceSettings, "accentColor">;

const statusColorMappings: readonly [StatusColorKey, string, number][] = [
  ["notStartedColor", "not-started", 0.16],
  ["playingColor", "playing", 0.13],
  ["onHoldColor", "on-hold", 0.12],
  ["waitingColor", "waiting", 0.12],
  ["completedColor", "completed", 0.12],
  ["unreleasedColor", "unreleased", 0.14],
  ["unobtainableColor", "unobtainable", 0.13],
];

function hexToRgb(hexColor: string): readonly [number, number, number] {
  return [
    Number.parseInt(hexColor.slice(1, 3), 16),
    Number.parseInt(hexColor.slice(3, 5), 16),
    Number.parseInt(hexColor.slice(5, 7), 16),
  ];
}

function rgbToHex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue]
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

function mixHexColors(
  sourceColor: string,
  targetColor: string,
  targetAmount: number,
): string {
  const source = hexToRgb(sourceColor);
  const target = hexToRgb(targetColor);

  return rgbToHex(
    source[0] + (target[0] - source[0]) * targetAmount,
    source[1] + (target[1] - source[1]) * targetAmount,
    source[2] + (target[2] - source[2]) * targetAmount,
  );
}

function rgbValue(hexColor: string): string {
  return hexToRgb(hexColor).join(", ");
}

export function pickAppearanceSettings(
  settings: AppSettings,
): AppearanceSettings {
  return {
    accentColor: settings.accentColor,
    notStartedColor: settings.notStartedColor,
    playingColor: settings.playingColor,
    onHoldColor: settings.onHoldColor,
    waitingColor: settings.waitingColor,
    completedColor: settings.completedColor,
    unreleasedColor: settings.unreleasedColor,
    unobtainableColor: settings.unobtainableColor,
  };
}

export function appearanceSettingsEqual(
  left: AppearanceSettings,
  right: AppearanceSettings,
): boolean {
  return appearanceSettingKeys.every((key) => left[key] === right[key]);
}

export function applyAppearanceSettings(settings: AppearanceSettings): void {
  const root = document.documentElement;

  const accentHover = mixHexColors(settings.accentColor, "#000000", 0.14);

  const accentBright = mixHexColors(settings.accentColor, "#ffffff", 0.22);

  const accentText = mixHexColors(settings.accentColor, "#ffffff", 0.62);

  root.style.setProperty("--color-accent", settings.accentColor);
  root.style.setProperty("--color-accent-rgb", rgbValue(settings.accentColor));
  root.style.setProperty("--color-accent-hover", accentHover);
  root.style.setProperty("--color-accent-bright", accentBright);
  root.style.setProperty("--color-accent-bright-rgb", rgbValue(accentBright));
  root.style.setProperty("--color-accent-text", accentText);
  root.style.setProperty(
    "--color-accent-soft",
    `rgba(${rgbValue(settings.accentColor)}, 0.16)`,
  );
  root.style.setProperty(
    "--color-border-hover",
    `rgba(${rgbValue(accentBright)}, 0.4)`,
  );
  root.style.setProperty(
    "--color-border-strong",
    `rgba(${rgbValue(accentBright)}, 0.55)`,
  );

  for (const [key, slug, backgroundOpacity] of statusColorMappings) {
    const color = settings[key];
    const textColor = mixHexColors(color, "#ffffff", 0.62);
    const colorRgb = rgbValue(color);

    root.style.setProperty(`--status-${slug}-color`, color);
    root.style.setProperty(`--status-${slug}-rgb`, colorRgb);
    root.style.setProperty(`--status-${slug}-text`, textColor);
    root.style.setProperty(
      `--status-${slug}-background`,
      `rgba(${colorRgb}, ${backgroundOpacity})`,
    );
  }
}
