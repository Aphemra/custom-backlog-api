import type { Bucket } from "../../../domain/backlog";

interface BucketCheckboxListProps {
  buckets: Bucket[];
  selectedBucketIds: string[];
  onToggleBucket: (bucketId: string) => void;
}

export function BucketCheckboxList({ buckets, selectedBucketIds, onToggleBucket }: BucketCheckboxListProps) {
  const sortedBuckets = [...buckets].sort((firstBucket, secondBucket) => firstBucket.order - secondBucket.order);

  if (sortedBuckets.length === 0) {
    return <p className="helper-text">No buckets exist yet. Create buckets from the Buckets panel.</p>;
  }

  return (
    <div className="checkbox-list">
      {sortedBuckets.map((bucket) => (
        <label className="checkbox-field" key={bucket.id}>
          <input type="checkbox" checked={selectedBucketIds.includes(bucket.id)} onChange={() => onToggleBucket(bucket.id)} />
          <span>{bucket.name}</span>
        </label>
      ))}
    </div>
  );
}
