import { ExternalLinkIcon } from "../../../components/ui/icons";
import {
  gameResourceProviderLabels,
  gameResourceTypeLabels,
  type GameResource,
} from "../../../domain/gameResource";

interface GameDetailsResourcesProps {
  readonly gameTitle: string;
  readonly resources: readonly GameResource[];
  readonly igdbUrl: string | null;
}

interface ResourceLinkProps {
  readonly href: string;
  readonly label: string;
  readonly description: string;
}

function ResourceLink({ href, label, description }: ResourceLinkProps) {
  return (
    <a
      className="game-details-resource-bar__link"
      href={href}
      target="_blank"
      rel="noreferrer"
      title={`${label} — ${description}`}
    >
      <ExternalLinkIcon />

      <span>{label}</span>
    </a>
  );
}

function resourceLabel(resource: GameResource): string {
  if (resource.label !== null) {
    return resource.label;
  }

  if (resource.provider === "other") {
    return gameResourceTypeLabels[resource.resourceType];
  }

  return (
    `${gameResourceProviderLabels[resource.provider]} ` +
    gameResourceTypeLabels[resource.resourceType].toLocaleLowerCase("en-US")
  );
}

export function GameDetailsResources({
  gameTitle,
  resources,
  igdbUrl,
}: GameDetailsResourcesProps) {
  const hasTrophyPage = resources.some(
    (resource) => resource.resourceType === "trophy_page",
  );

  const psnProfilesSearchUrl =
    `https://psnprofiles.com/search/games?q=` + encodeURIComponent(gameTitle);

  return (
    <nav
      className="game-details-resource-bar"
      aria-label={`External resources for ${gameTitle}`}
    >
      <strong className="game-details-resource-bar__label">Resources</strong>

      <div className="game-details-resource-bar__links">
        {hasTrophyPage ? null : (
          <ResourceLink
            href={psnProfilesSearchUrl}
            label="Search PSNProfiles"
            description="Fallback trophy-page search"
          />
        )}

        {resources.map((resource) => (
          <ResourceLink
            key={resource.id}
            href={resource.url}
            label={resourceLabel(resource)}
            description={
              `${gameResourceProviderLabels[resource.provider]} ` +
              gameResourceTypeLabels[resource.resourceType]
            }
          />
        ))}

        {igdbUrl === null ? null : (
          <ResourceLink
            href={igdbUrl}
            label="IGDB"
            description="Game metadata source"
          />
        )}
      </div>
    </nav>
  );
}
