import { TrophyIcon } from "../../../components/ui/icons";
import type {
  GameResource,
  GameResourceProvider,
} from "../../../domain/gameResource";

interface GameResourceLinksProps {
  readonly gameTitle: string;
  readonly resources: readonly GameResource[];
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="m15 15 5 5" />
    </svg>
  );
}

function GuideIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v17H7.5A3.5 3.5 0 0 0 4 22V5.5Z" />
      <path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H13v17h3.5A3.5 3.5 0 0 1 20 22V5.5Z" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Z" />
      <circle cx="12" cy="10" r="2" />
    </svg>
  );
}

function guideProviderMarker(provider: GameResourceProvider): string {
  switch (provider) {
    case "powerpyx":
      return "PX";
    case "psnprofiles":
      return "PP";
    default:
      return "G";
  }
}

function resourceName(resource: GameResource): string {
  if (resource.label !== null) {
    return resource.label;
  }

  switch (resource.provider) {
    case "psnprofiles":
      return resource.resourceType === "guide"
        ? "PSNProfiles guide"
        : "PSNProfiles trophy page";
    case "powerpyx":
      return "PowerPyx guide";
    case "mapgenie":
      return "MapGenie interactive map";
    default:
      return resource.resourceType === "guide"
        ? "Game guide"
        : "Interactive map";
  }
}

export function GameResourceLinks({
  gameTitle,
  resources,
}: GameResourceLinksProps) {
  const trophyPage = resources.find(
    (resource) => resource.resourceType === "trophy_page",
  );

  const guides = resources.filter(
    (resource) => resource.resourceType === "guide",
  );

  const interactiveMaps = resources.filter(
    (resource) => resource.resourceType === "interactive_map",
  );

  const trophySearchUrl = `https://psnprofiles.com/search/games?q=${encodeURIComponent(gameTitle)}`;

  return (
    <nav
      className="game-resource-links"
      aria-label={`Useful links for ${gameTitle}`}
    >
      {trophyPage === undefined ? (
        <a
          className="game-resource-link game-resource-link--search"
          href={trophySearchUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Search PSNProfiles for ${gameTitle}`}
          title="Search PSNProfiles"
        >
          <SearchIcon />
        </a>
      ) : (
        <a
          className="game-resource-link game-resource-link--trophy"
          href={trophyPage.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${resourceName(trophyPage)}`}
          title={resourceName(trophyPage)}
        >
          <TrophyIcon />
        </a>
      )}

      {guides.map((guide) => (
        <a
          className={`game-resource-link game-resource-link--guide game-resource-link--${guide.provider}`}
          href={guide.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${resourceName(guide)}`}
          title={resourceName(guide)}
          key={guide.id}
        >
          <GuideIcon />

          <span className="game-resource-link__provider" aria-hidden="true">
            {guideProviderMarker(guide.provider)}
          </span>
        </a>
      ))}

      {interactiveMaps.map((interactiveMap) => (
        <a
          className="game-resource-link game-resource-link--map"
          href={interactiveMap.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${resourceName(interactiveMap)}`}
          title={resourceName(interactiveMap)}
          key={interactiveMap.id}
        >
          <MapIcon />
        </a>
      ))}
    </nav>
  );
}
