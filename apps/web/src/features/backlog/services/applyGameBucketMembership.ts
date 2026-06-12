import type { Bucket } from "../../../domain/backlog";

interface ApplyGameBucketMembershipInput {
  buckets: Bucket[];
  gameEntryId: string;
  nextBucketIds: string[];
  updatedAt: string;
}

export function applyGameBucketMembership({ buckets, gameEntryId, nextBucketIds, updatedAt }: ApplyGameBucketMembershipInput): Bucket[] {
  return buckets.map((bucket) => {
    const shouldContainGame = nextBucketIds.includes(bucket.id);
    const currentlyContainsGame = bucket.gameOrder.includes(gameEntryId);

    if (shouldContainGame && currentlyContainsGame) {
      return bucket;
    }

    if (shouldContainGame && !currentlyContainsGame) {
      return {
        ...bucket,
        gameOrder: [...bucket.gameOrder, gameEntryId],
        updatedAt,
      };
    }

    if (!shouldContainGame && currentlyContainsGame) {
      return {
        ...bucket,
        gameOrder: bucket.gameOrder.filter((orderedGameId) => orderedGameId !== gameEntryId),
        updatedAt,
      };
    }

    return bucket;
  });
}
