import type { PlatformId } from "../../../domain/platform";

export function mapIgdbPlatformsToPlatformIds(platforms: string[]): PlatformId[] {
  const platformIds = platforms
    .map((platform) => mapIgdbPlatformToPlatformId(platform))
    .filter((platformId): platformId is PlatformId => platformId !== null);

  return Array.from(new Set(platformIds));
}

function mapIgdbPlatformToPlatformId(platform: string): PlatformId | null {
  const normalizedPlatform = platform.trim().toLowerCase();

  switch (normalizedPlatform) {
    case "ps1":
    case "playstation":
      return "ps1";

    case "ps2":
    case "playstation 2":
      return "ps2";

    case "ps3":
    case "playstation 3":
      return "ps3";

    case "ps4":
    case "playstation 4":
      return "ps4";

    case "ps5":
    case "playstation 5":
      return "ps5";

    case "psp":
    case "playstation portable":
      return "psp";

    case "vita":
    case "ps vita":
    case "playstation vita":
      return "ps-vita";

    case "ps vr":
    case "psvr":
    case "playstation vr":
      return "psvr";

    case "ps vr2":
    case "psvr2":
    case "playstation vr2":
      return "psvr2";

    default:
      return null;
  }
}
