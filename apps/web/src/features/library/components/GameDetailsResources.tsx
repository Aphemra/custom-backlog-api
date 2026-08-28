import {
  gameResourceProviderLabels,
  gameResourceTypeLabels,
  type GameResource,
} from "../../../domain/gameResource";
import { GameResourceLinks } from "./GameResourceLinks";

interface GameDetailsResourcesProps {
  readonly gameTitle: string;
  readonly resources: readonly GameResource[];
  readonly igdbUrl: string | null;
}

export function GameDetailsResources({
  gameTitle,
  resources,
  igdbUrl,
}: GameDetailsResourcesProps) {
  const hasTrophyPage = resources.some(
    (resource) => resource.resourceType === "trophy_page",
  );

  const psnProfilesSearchUrl = `https://psnprofiles.com/search/games?q=${encodeURIComponent(gameTitle)}`;

  return (
    <section className="game-details__section">
      <div className="game-details__section-heading">
        <div>
          <p className="eyebrow">External resources</p>
          <h3>Useful links</h3>
        </div>

        <GameResourceLinks gameTitle={gameTitle} resources={resources} />
      </div>

      <ul className="game-details-resources">
        {hasTrophyPage ? null : (
          <li>
            <div>
              <strong>Search PSNProfiles</strong>
              <span>Fallback trophy-page search</span>
            </div>

            <a href={psnProfilesSearchUrl} target="_blank" rel="noreferrer">
              Open
            </a>
          </li>
        )}

        {resources.map((resource) => (
          <li key={resource.id}>
            <div>
              <strong>
                {resource.label ??
                  gameResourceTypeLabels[resource.resourceType]}
              </strong>

              <span>
                {gameResourceProviderLabels[resource.provider]} ·{" "}
                {gameResourceTypeLabels[resource.resourceType]}
              </span>
            </div>

            <a href={resource.url} target="_blank" rel="noreferrer">
              Open
            </a>
          </li>
        ))}

        {igdbUrl === null ? null : (
          <li>
            <div>
              <strong>IGDB game entry</strong>
              <span>Metadata source</span>
            </div>

            <a href={igdbUrl} target="_blank" rel="noreferrer">
              Open
            </a>
          </li>
        )}
      </ul>
    </section>
  );
}
