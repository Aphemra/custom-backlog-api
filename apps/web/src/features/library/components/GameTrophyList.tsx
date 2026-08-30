import { useEffect, useMemo, useState } from "react";
import { TrophyGradeIcon } from "../../../components/ui/icons";
import type {
  StoredPlayStationTrophy,
  StoredPlayStationTrophySet,
} from "../../../domain/playStation";
import { ApiError } from "../../../services/api/apiClient";
import { playStationApi } from "../../../services/api/playStationApi";

const trophyFilters = ["all", "earned", "locked", "secret"] as const;

type TrophyFilter = (typeof trophyFilters)[number];

const trophyFilterLabels: Readonly<Record<TrophyFilter, string>> = {
  all: "All",
  earned: "Earned",
  locked: "Locked",
  secret: "Secret",
};

interface GameTrophyListProps {
  readonly gameId: string;
  readonly hasPlayStationLink: boolean;
}

type LoadState = "loading" | "ready" | "missing" | "error";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "The locally stored trophy list could not be loaded.";
}

function trophyIconUrl(trophy: StoredPlayStationTrophy): string | null {
  if (trophy.iconImageId !== null) {
    return `/api/images/${encodeURIComponent(trophy.iconImageId)}`;
  }

  return trophy.iconUrl;
}

function trophyMatchesFilter(
  trophy: StoredPlayStationTrophy,
  filter: TrophyFilter,
): boolean {
  switch (filter) {
    case "earned":
      return trophy.earned;

    case "locked":
      return !trophy.earned;

    case "secret":
      return trophy.secret;

    case "all":
      return true;
  }
}

function formatEarnedDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function trophyDisplayName(trophy: StoredPlayStationTrophy): string {
  if (trophy.name !== null && trophy.name.trim() !== "") {
    return trophy.name;
  }

  return trophy.secret && !trophy.earned
    ? "Secret trophy"
    : `Trophy #${trophy.trophyId}`;
}

interface TrophyEntryProps {
  readonly trophy: StoredPlayStationTrophy;
  readonly revealed: boolean;
  readonly onReveal: () => void;
}

function TrophyEntry({ trophy, revealed, onReveal }: TrophyEntryProps) {
  const concealed = trophy.secret && !trophy.earned && !revealed;

  if (concealed) {
    return (
      <li className="game-trophy game-trophy--locked game-trophy--concealed">
        <button
          className="game-trophy__reveal"
          type="button"
          aria-label="Reveal secret trophy"
          onClick={onReveal}
        >
          <div className="game-trophy__icon">
            <TrophyGradeIcon grade="secret" />
          </div>

          <div className="game-trophy__content">
            <div className="game-trophy__heading">
              <strong>Secret trophy</strong>
            </div>

            <p>Name, description, artwork, and trophy grade are hidden.</p>

            <div className="game-trophy__status">
              <strong>Click to reveal</strong>
            </div>
          </div>
        </button>
      </li>
    );
  }

  const imageUrl = trophyIconUrl(trophy);

  return (
    <li
      className={`game-trophy${
        trophy.earned ? " game-trophy--earned" : " game-trophy--locked"
      }`}
    >
      <div className="game-trophy__icon">
        {imageUrl === null ? (
          <TrophyGradeIcon grade={trophy.trophyType} />
        ) : (
          <img src={imageUrl} alt="" loading="lazy" decoding="async" />
        )}
      </div>

      <div className="game-trophy__content">
        <div className="game-trophy__heading">
          <strong>{trophyDisplayName(trophy)}</strong>

          <div className="game-trophy__badges">
            <TrophyGradeIcon grade={trophy.trophyType} />

            {trophy.unobtainable ? (
              <span className="game-trophy__unobtainable">Unobtainable</span>
            ) : null}
          </div>
        </div>

        {trophy.detail === null ? null : <p>{trophy.detail}</p>}

        {trophy.unobtainableReason === null ? null : (
          <p className="game-trophy__unobtainable-reason">
            {trophy.unobtainableReason}
          </p>
        )}

        <div className="game-trophy__status">
          {trophy.earned ? (
            <>
              <strong>Earned</strong>

              {trophy.earnedAt === null ? (
                <span>Timestamp unavailable</span>
              ) : (
                <time dateTime={trophy.earnedAt}>
                  {formatEarnedDate(trophy.earnedAt)}
                </time>
              )}
            </>
          ) : (
            <span>Locked</span>
          )}
        </div>
      </div>
    </li>
  );
}

export function GameTrophyList({
  gameId,
  hasPlayStationLink,
}: GameTrophyListProps) {
  const [trophySet, setTrophySet] = useState<StoredPlayStationTrophySet | null>(
    null,
  );

  const [loadState, setLoadState] = useState<LoadState>("loading");

  const [activeFilter, setActiveFilter] = useState<TrophyFilter>("all");

  const [expanded, setExpanded] = useState(false);

  const [revealedSecretTrophies, setRevealedSecretTrophies] = useState<
    ReadonlySet<string>
  >(new Set());

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!hasPlayStationLink || !expanded || trophySet !== null) {
      return;
    }

    const controller = new AbortController();

    void playStationApi
      .getStoredTrophySet(gameId, controller.signal)
      .then((loadedTrophySet) => {
        setTrophySet(loadedTrophySet);
        setLoadState("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (error instanceof ApiError && error.status === 404) {
          setLoadState("missing");
          return;
        }

        setErrorMessage(getErrorMessage(error));
        setLoadState("error");
      });

    return () => controller.abort();
  }, [expanded, gameId, hasPlayStationLink, trophySet]);

  const allTrophies = useMemo(
    () => trophySet?.groups.flatMap((group) => group.trophies) ?? [],
    [trophySet],
  );

  const filterCounts = useMemo(
    () => ({
      all: allTrophies.length,
      earned: allTrophies.filter((trophy) => trophy.earned).length,
      locked: allTrophies.filter((trophy) => !trophy.earned).length,
      secret: allTrophies.filter((trophy) => trophy.secret).length,
    }),
    [allTrophies],
  );

  const visibleGroups = useMemo(
    () =>
      trophySet?.groups
        .map((group) => ({
          ...group,
          trophies: group.trophies.filter((trophy) =>
            trophyMatchesFilter(trophy, activeFilter),
          ),
        }))
        .filter((group) => group.trophies.length > 0) ?? [],
    [activeFilter, trophySet],
  );

  if (!hasPlayStationLink) {
    return null;
  }

  return (
    <details
      className="game-trophy-disclosure"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>
        <span>
          <strong>Complete trophy list</strong>

          <small>
            Trophy groups, earned status, secrets, and unobtainable trophies
          </small>
        </span>

        <span className="game-trophy-disclosure__count">
          {trophySet === null
            ? "Locally cached"
            : `${filterCounts.earned} / ${filterCounts.all}`}
        </span>
      </summary>

      <div className="game-trophy-disclosure__body">
        {loadState === "loading" ? (
          <div className="game-trophy-list__loading" role="status">
            Loading locally cached trophy details…
          </div>
        ) : null}

        {loadState === "missing" ? (
          <p className="game-details__empty-copy">
            This game is connected to PlayStation, but its complete trophy
            definitions have not been cached yet. The next full PSN
            synchronization can retrieve them.
          </p>
        ) : null}

        {loadState === "error" ? (
          <div className="notice notice--error" role="alert">
            {errorMessage}
          </div>
        ) : null}

        {loadState === "ready" && trophySet !== null ? (
          <>
            <div className="game-trophy-filters" aria-label="Filter trophies">
              {trophyFilters.map((filter) => (
                <button
                  className="game-trophy-filter"
                  type="button"
                  key={filter}
                  aria-pressed={activeFilter === filter}
                  onClick={() => setActiveFilter(filter)}
                >
                  <span>{trophyFilterLabels[filter]}</span>
                  <strong>{filterCounts[filter]}</strong>
                </button>
              ))}
            </div>

            {visibleGroups.length === 0 ? (
              <p className="game-details__empty-copy">
                No trophies match this filter.
              </p>
            ) : (
              <div className="game-trophy-groups" aria-live="polite">
                {visibleGroups.map((group, groupIndex) => (
                  <details
                    className="game-trophy-group"
                    key={group.trophyGroupId}
                    open={groupIndex === 0}
                  >
                    <summary className="game-trophy-group__heading">
                      <h4>{group.name}</h4>

                      <span>
                        {
                          group.trophies.filter((trophy) => trophy.earned)
                            .length
                        }{" "}
                        / {group.trophies.length}
                      </span>
                    </summary>

                    <ul className="game-trophy-list">
                      {group.trophies.map((trophy) => {
                        const trophyKey = `${group.trophyGroupId}:${trophy.trophyId}`;

                        return (
                          <TrophyEntry
                            key={trophyKey}
                            trophy={trophy}
                            revealed={
                              activeFilter === "secret" ||
                              revealedSecretTrophies.has(trophyKey)
                            }
                            onReveal={() =>
                              setRevealedSecretTrophies((currentTrophies) => {
                                const updatedTrophies = new Set(
                                  currentTrophies,
                                );

                                updatedTrophies.add(trophyKey);

                                return updatedTrophies;
                              })
                            }
                          />
                        );
                      })}
                    </ul>
                  </details>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </details>
  );
}
