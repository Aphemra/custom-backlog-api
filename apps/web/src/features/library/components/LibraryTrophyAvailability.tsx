import { useEffect, useState } from "react";
import type {
  StoredPlayStationTrophy,
  StoredPlayStationTrophySet,
} from "../../../domain/playStation";
import { ApiError } from "../../../services/api/apiClient";
import { playStationApi } from "../../../services/api/playStationApi";
import { TrophyGradeIcon } from "../../../components/ui/icons";

interface LibraryTrophyAvailabilityProps {
  readonly gameId: string;
  readonly onAvailabilityChanged?: () => Promise<void>;
}

function getErrorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "The locally stored trophy list could not be loaded.";
}

function trophyIconUrl(trophy: StoredPlayStationTrophy): string | null {
  return trophy.iconImageId === null
    ? trophy.iconUrl
    : `/api/images/${encodeURIComponent(trophy.iconImageId)}`;
}

export function LibraryTrophyAvailability({
  gameId,
  onAvailabilityChanged,
}: LibraryTrophyAvailabilityProps) {
  const [trophySet, setTrophySet] = useState<StoredPlayStationTrophySet | null>(
    null,
  );
  const [reasons, setReasons] = useState<Readonly<Record<number, string>>>({});
  const [loading, setLoading] = useState(true);
  const [busyTrophyId, setBusyTrophyId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    async function load(): Promise<void> {
      try {
        const loaded = await playStationApi.getStoredTrophySet(
          gameId,
          abortController.signal,
        );

        if (!abortController.signal.aborted) {
          setTrophySet(loaded);
          setReasons(
            Object.fromEntries(
              loaded.groups.flatMap((group) =>
                group.trophies.map((trophy) => [
                  trophy.trophyId,
                  trophy.unobtainableReason ?? "",
                ]),
              ),
            ),
          );
        }
      } catch (error) {
        if (
          !abortController.signal.aborted &&
          !(error instanceof ApiError && error.status === 404)
        ) {
          setErrorMessage(getErrorMessage(error));
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => abortController.abort();
  }, [gameId]);

  async function updateAvailability(
    trophy: StoredPlayStationTrophy,
    unobtainable: boolean,
    reason: string | null,
  ): Promise<void> {
    setBusyTrophyId(trophy.trophyId);
    setErrorMessage(null);

    try {
      const updatedTrophySet = await playStationApi.updateTrophyAvailability(
        gameId,
        trophy.trophyId,
        unobtainable,
        reason,
      );

      setTrophySet(updatedTrophySet);
      await onAvailabilityChanged?.();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyTrophyId(null);
    }
  }

  if (loading) {
    return <p className="trophy-availability__status">Loading trophies…</p>;
  }

  if (trophySet === null && errorMessage === null) {
    return null;
  }

  const unobtainableCount =
    trophySet?.groups
      .flatMap((group) => group.trophies)
      .filter((trophy) => trophy.unobtainable).length ?? 0;

  return (
    <details className="trophy-availability">
      <summary>
        <span>
          <strong>Trophy availability</strong>
          <small>
            {unobtainableCount}{" "}
            {unobtainableCount === 1 ? "trophy" : "trophies"} marked
            unobtainable.
          </small>
        </span>
      </summary>

      {errorMessage === null ? null : (
        <p className="trophy-availability__error" role="alert">
          {errorMessage}
        </p>
      )}

      {trophySet?.groups.map((group, groupIndex) => (
        <details
          className="trophy-availability__group"
          key={group.trophyGroupId}
          open={groupIndex === 0}
        >
          <summary className="trophy-availability__group-heading">
            <strong>{group.name}</strong>

            <span>
              {group.trophies.filter((trophy) => trophy.unobtainable).length} /{" "}
              {group.trophies.length} unavailable
            </span>
          </summary>

          <ul>
            {group.trophies.map((trophy) => {
              const imageUrl = trophyIconUrl(trophy);
              const busy = busyTrophyId === trophy.trophyId;
              const reason = reasons[trophy.trophyId] ?? "";

              return (
                <li
                  className={
                    trophy.unobtainable
                      ? "trophy-availability__item trophy-availability__item--unobtainable"
                      : "trophy-availability__item"
                  }
                  key={trophy.trophyId}
                >
                  <span className="trophy-availability__art">
                    {imageUrl === null ? (
                      <TrophyGradeIcon grade={trophy.trophyType} />
                    ) : (
                      <img src={imageUrl} alt="" loading="lazy" />
                    )}
                  </span>

                  <div className="trophy-availability__body">
                    <div className="trophy-availability__title">
                      <strong>
                        {trophy.name ?? `Hidden trophy #${trophy.trophyId}`}
                      </strong>

                      {trophy.earned ? (
                        <span className="trophy-availability__earned">
                          Earned
                        </span>
                      ) : null}

                      <TrophyGradeIcon grade={trophy.trophyType} />
                    </div>

                    <div className="trophy-availability__controls">
                      <label className="trophy-availability__toggle">
                        <input
                          type="checkbox"
                          checked={trophy.unobtainable}
                          disabled={busy}
                          onChange={(event) =>
                            void updateAvailability(
                              trophy,
                              event.target.checked,
                              event.target.checked && reason.trim() !== ""
                                ? reason.trim()
                                : null,
                            )
                          }
                        />

                        <span>Unobtainable</span>
                      </label>

                      {trophy.unobtainable ? (
                        <input
                          className="trophy-availability__reason"
                          type="text"
                          maxLength={500}
                          value={reason}
                          disabled={busy}
                          aria-label={`Reason ${
                            trophy.name ?? trophy.trophyId
                          }`}
                          placeholder="Optional reason, such as closed servers"
                          onChange={(event) =>
                            setReasons((current) => ({
                              ...current,
                              [trophy.trophyId]: event.target.value,
                            }))
                          }
                          onBlur={() => {
                            const normalizedReason =
                              reason.trim() === "" ? null : reason.trim();

                            if (
                              normalizedReason !== trophy.unobtainableReason
                            ) {
                              void updateAvailability(
                                trophy,
                                true,
                                normalizedReason,
                              );
                            }
                          }}
                        />
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </details>
      ))}
    </details>
  );
}
