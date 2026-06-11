import { useState, type FormEvent } from "react";
import { countGamesInBucket } from "../services/countGamesInBucket";
import { useBacklogStore } from "../store/useBacklogStore";

export function BucketPanel() {
  const buckets = useBacklogStore((state) => state.buckets);
  const gameEntries = useBacklogStore((state) => state.gameEntries);
  const filters = useBacklogStore((state) => state.filters);

  const closeBucketPanel = useBacklogStore((state) => state.closeBucketPanel);
  const createBucket = useBacklogStore((state) => state.createBucket);
  const renameBucket = useBacklogStore((state) => state.renameBucket);
  const deleteBucket = useBacklogStore((state) => state.deleteBucket);
  const setBucketFilter = useBacklogStore((state) => state.setBucketFilter);

  const [newBucketName, setNewBucketName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const sortedBuckets = [...buckets].sort((firstBucket, secondBucket) => firstBucket.order - secondBucket.order);

  function handleCreateBucket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = newBucketName.trim();

    if (!trimmedName) {
      setFormError("Bucket name is required.");
      return;
    }

    const nameAlreadyExists = buckets.some((bucket) => bucket.name.toLowerCase() === trimmedName.toLowerCase());

    if (nameAlreadyExists) {
      setFormError("A bucket with that name already exists.");
      return;
    }

    createBucket(trimmedName);
    setNewBucketName("");
    setFormError(null);
  }

  function handleRenameBucket(bucketId: string, currentName: string) {
    const newName = window.prompt("Rename bucket:", currentName);

    if (newName === null) {
      return;
    }

    const trimmedName = newName.trim();

    if (!trimmedName) {
      window.alert("Bucket name cannot be empty.");
      return;
    }

    renameBucket(bucketId, trimmedName);
  }

  function handleDeleteBucket(bucketId: string, bucketName: string) {
    const gameCount = countGamesInBucket(gameEntries, bucketId);

    const shouldDelete = window.confirm(
      `Delete "${bucketName}"? ${gameCount} game(s) will be removed from this bucket, but the games themselves will stay in your backlog.`,
    );

    if (shouldDelete) {
      deleteBucket(bucketId);
    }
  }

  return (
    <section className="bucket-panel" aria-label="Bucket manager">
      <div className="details-toolbar">
        <div>
          <h3>Buckets</h3>
          <p>Create custom groups like series, cleanup lists, or priority sets.</p>
        </div>

        <button className="button" type="button" onClick={closeBucketPanel}>
          Close
        </button>
      </div>

      <form className="bucket-create-form" onSubmit={handleCreateBucket}>
        <label className="field">
          <span>New Bucket Name</span>
          <input value={newBucketName} onChange={(event) => setNewBucketName(event.target.value)} placeholder="Final Fantasy, RGG, Short Plats..." />
        </label>

        <button className="button button--primary" type="submit">
          Create
        </button>
      </form>

      {formError ? <p className="form-error">{formError}</p> : null}

      <div className="bucket-list">
        <button
          className={`bucket-list-item ${filters.bucketId === null ? "bucket-list-item--active" : ""}`}
          type="button"
          onClick={() => setBucketFilter(null)}
        >
          <span>
            <strong>All Games</strong>
            <small>{gameEntries.length} total</small>
          </span>
        </button>

        {sortedBuckets.map((bucket) => {
          const gameCount = countGamesInBucket(gameEntries, bucket.id);
          const isActive = filters.bucketId === bucket.id;

          return (
            <article className={`bucket-list-item ${isActive ? "bucket-list-item--active" : ""}`} key={bucket.id}>
              <button type="button" onClick={() => setBucketFilter(bucket.id)}>
                <span>
                  <strong>{bucket.name}</strong>
                  <small>{gameCount} game(s)</small>
                </span>
              </button>

              <div className="bucket-list-item__actions">
                <button className="button" type="button" onClick={() => handleRenameBucket(bucket.id, bucket.name)}>
                  Rename
                </button>

                <button className="button button--danger" type="button" onClick={() => handleDeleteBucket(bucket.id, bucket.name)}>
                  Delete
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
