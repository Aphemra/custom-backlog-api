import { useState } from "react";
import { playstationPlatforms } from "../../../data/mock/playstationPlatforms";
import type { PlayStatus } from "../../../domain/backlog";
import { formatPlayStatus, formatTrophyStatus } from "../../../domain/display";
import { BucketCheckboxList } from "./BucketCheckboxList";
import type { PlatformId } from "../../../domain/platform";
import type { TrophyStatus } from "../../../domain/trophy";
import { parseOptionalNumber } from "../services/parseOptionalNumber";
import { useBacklogStore } from "../store/useBacklogStore";
import type { IgdbGameSearchResult } from "../../../services/api/igdbApi";
import { mapIgdbPlatformsToPlatformIds } from "../services/mapIgdbPlatformsToPlatformIds";
import { IgdbSearchPanel } from "./IgdbSearchPanel";
import type { GameExternalMetadata } from "../../../domain/externalMetadata";
import { createIgdbMetadataSnapshot } from "../services/createIgdbMetadataSnapshot";

const playStatusOptions: PlayStatus[] = ["backlog", "playing", "beaten", "completed", "shelved", "abandoned"];

const trophyStatusOptions: TrophyStatus[] = [
  "not_started",
  "started",
  "cleanup",
  "platinumed",
  "hundred_percent",
  "skipped",
  "unobtainable",
  "not_applicable",
];

export function AddGamePanel() {
  const addGameEntry = useBacklogStore((state) => state.addGameEntry);
  const closeAddGamePanel = useBacklogStore((state) => state.closeAddGamePanel);
  const buckets = useBacklogStore((state) => state.buckets);
  const filters = useBacklogStore((state) => state.filters);

  const [title, setTitle] = useState("");
  const [externalMetadata, setExternalMetadata] = useState<GameExternalMetadata>();
  const [platformIds, setPlatformIds] = useState<PlatformId[]>(["ps5"]);
  const [bucketIds, setBucketIds] = useState<string[]>(filters.bucketId ? [filters.bucketId] : []);
  const [playStatus, setPlayStatus] = useState<PlayStatus>("backlog");
  const [trophyStatus, setTrophyStatus] = useState<TrophyStatus>("not_started");
  const [completionPercent, setCompletionPercent] = useState("");
  const [earnedTrophies, setEarnedTrophies] = useState("");
  const [totalTrophies, setTotalTrophies] = useState("");
  const [platinumEarned, setPlatinumEarned] = useState(false);
  const [psnProfilesUrl, setPsnProfilesUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  function togglePlatform(platformId: PlatformId) {
    setPlatformIds((currentPlatformIds) =>
      currentPlatformIds.includes(platformId)
        ? currentPlatformIds.filter((currentId) => currentId !== platformId)
        : [...currentPlatformIds, platformId],
    );
  }

  function toggleBucket(bucketId: string) {
    setBucketIds((currentBucketIds) =>
      currentBucketIds.includes(bucketId) ? currentBucketIds.filter((currentId) => currentId !== bucketId) : [...currentBucketIds, bucketId],
    );
  }

  function handleSelectIgdbGame(game: IgdbGameSearchResult) {
    const mappedPlatformIds = mapIgdbPlatformsToPlatformIds(game.platforms);

    setTitle(game.name);
    setExternalMetadata(createIgdbMetadataSnapshot(game));

    if (mappedPlatformIds.length > 0) {
      setPlatformIds(mappedPlatformIds);
    }

    setFormError(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setFormError("Game title is required.");
      return;
    }

    if (platformIds.length === 0) {
      setFormError("At least one platform is required.");
      return;
    }

    const parsedCompletionPercent = parseOptionalNumber(completionPercent);
    const parsedEarnedTrophies = parseOptionalNumber(earnedTrophies);
    const parsedTotalTrophies = parseOptionalNumber(totalTrophies);

    if (parsedCompletionPercent !== undefined && (parsedCompletionPercent < 0 || parsedCompletionPercent > 100)) {
      setFormError("Completion percent must be between 0 and 100.");
      return;
    }

    if (parsedEarnedTrophies !== undefined && parsedTotalTrophies !== undefined && parsedEarnedTrophies > parsedTotalTrophies) {
      setFormError("Earned trophies cannot be higher than total trophies.");
      return;
    }

    setFormError(null);

    addGameEntry({
      title: trimmedTitle,
      platformIds,
      playStatus,
      trophyStatus,
      trophyProgress: {
        completionPercent: parsedCompletionPercent,
        earnedTrophies: parsedEarnedTrophies,
        totalTrophies: parsedTotalTrophies,
        platinumEarned,
        psnProfilesUrl: psnProfilesUrl.trim() || undefined,
      },
      bucketIds,
      externalMetadata,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <form className="add-game-panel" onSubmit={handleSubmit}>
      <div className="details-toolbar">
        <div>
          <h3>Add Game</h3>
          <p>Create a manual backlog entry or prefill one from mock IGDB.</p>
        </div>

        <div className="form-actions">
          <button className="button" type="button" onClick={closeAddGamePanel}>
            Cancel
          </button>

          <button className="button button--primary" type="submit">
            Save Game
          </button>
        </div>
      </div>

      <IgdbSearchPanel onSelectGame={handleSelectIgdbGame} />

      {externalMetadata?.igdb ? (
        <p className="helper-text">
          Prefilled from mock IGDB: {externalMetadata.igdb.name}
          {externalMetadata.igdb.firstReleaseYear ? ` (${externalMetadata.igdb.firstReleaseYear})` : ""}
        </p>
      ) : null}

      {formError ? <p className="form-error">{formError}</p> : null}

      <div className="form-grid">
        <label className="field field--wide">
          <span>Game Title</span>
          <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>

        <label className="field">
          <span>Play Status</span>
          <select value={playStatus} onChange={(event) => setPlayStatus(event.target.value as PlayStatus)}>
            {playStatusOptions.map((status) => (
              <option value={status} key={status}>
                {formatPlayStatus(status)}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Trophy Status</span>
          <select value={trophyStatus} onChange={(event) => setTrophyStatus(event.target.value as TrophyStatus)}>
            {trophyStatusOptions.map((status) => (
              <option value={status} key={status}>
                {formatTrophyStatus(status)}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Completion %</span>
          <input inputMode="decimal" value={completionPercent} onChange={(event) => setCompletionPercent(event.target.value)} />
        </label>

        <label className="field">
          <span>Earned Trophies</span>
          <input inputMode="numeric" value={earnedTrophies} onChange={(event) => setEarnedTrophies(event.target.value)} />
        </label>

        <label className="field">
          <span>Total Trophies</span>
          <input inputMode="numeric" value={totalTrophies} onChange={(event) => setTotalTrophies(event.target.value)} />
        </label>

        <label className="field field--wide">
          <span>PSNProfiles URL</span>
          <input value={psnProfilesUrl} onChange={(event) => setPsnProfilesUrl(event.target.value)} />
        </label>

        <fieldset className="field field--wide checkbox-group">
          <legend>Platforms</legend>

          <div className="checkbox-list">
            {playstationPlatforms.map((platform) => (
              <label className="checkbox-field" key={platform.id}>
                <input type="checkbox" checked={platformIds.includes(platform.id)} onChange={() => togglePlatform(platform.id)} />
                <span>{platform.shortName}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="field field--wide checkbox-group">
          <legend>Buckets</legend>

          <BucketCheckboxList buckets={buckets} selectedBucketIds={bucketIds} onToggleBucket={toggleBucket} />
        </fieldset>

        <label className="checkbox-field field--wide">
          <input type="checkbox" checked={platinumEarned} onChange={(event) => setPlatinumEarned(event.target.checked)} />
          <span>Platinum earned</span>
        </label>

        <label className="field field--wide">
          <span>Notes</span>
          <textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
      </div>
    </form>
  );
}
