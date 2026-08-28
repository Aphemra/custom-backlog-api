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
      setTrophySet(
        await playStationApi.updateTrophyAvailability(
          gameId,
          trophy.trophyId,
          unobtainable,
          reason,
        ),
      );
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

  return (
    <details className="trophy-availability">
      <summary>
        Trophy availability
        {trophySet === null
          ? null
          : ` · ${
              trophySet.groups
                .flatMap((group) => group.trophies)
                .filter((trophy) => trophy.unobtainable).length
            } marked`}
      </summary>

      {errorMessage === null ? null : (
        <p className="trophy-availability__error" role="alert">
          {errorMessage}
        </p>
      )}

      {trophySet?.groups.map((group) => (
        <section key={group.trophyGroupId}>
          <h3>{group.name}</h3>

          <ul>
            {group.trophies.map((trophy) => {
              const imageUrl = trophyIconUrl(trophy);
              const busy = busyTrophyId === trophy.trophyId;
              const reason = reasons[trophy.trophyId] ?? "";

              return (
                <li key={trophy.trophyId}>
                  {imageUrl === null ? null : (
                    <img src={imageUrl} alt="" loading="lazy" />
                  )}

                  <div className="trophy-availability__body">
                    <div className="trophy-availability__title">
                      <strong>
                        {trophy.name ?? `Hidden trophy #${trophy.trophyId}`}
                      </strong>

                      <TrophyGradeIcon grade={trophy.trophyType} />

                      {trophy.earned ? <span>Earned</span> : null}
                    </div>

                    <label className="checkbox-control">
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
                        maxLength={500}
                        value={reason}
                        disabled={busy}
                        aria-label={`Reason ${trophy.name ?? trophy.trophyId}`}
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

                          if (normalizedReason !== trophy.unobtainableReason) {
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
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </details>
  );
}
