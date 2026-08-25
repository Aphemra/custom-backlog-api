import assert from "node:assert/strict";
import { test } from "node:test";
import { HttpError } from "../../errors/httpError.js";
import {
  parseCollectionGameOrder,
  parseCreateCollectionInput,
  parseUpdateCollectionInput,
} from "./collectionValidation.js";

test("normalizes valid collection input", () => {
  assert.deepEqual(
    parseCreateCollectionInput({
      name: "  Resident Evil  ",
      description: "  Mainline games  ",
    }),
    {
      name: "Resident Evil",
      description: "Mainline games",
    },
  );

  assert.deepEqual(
    parseUpdateCollectionInput({
      description: "   ",
    }),
    {
      description: null,
    },
  );
});

test("rejects invalid and duplicate collection data", () => {
  assert.throws(
    () => parseCreateCollectionInput({ name: "" }),
    (error: unknown) =>
      error instanceof HttpError && error.code === "invalid_collection_name",
  );

  assert.throws(
    () =>
      parseCollectionGameOrder({
        orderedGameIds: ["one", "one"],
      }),
    (error: unknown) =>
      error instanceof HttpError && error.code === "duplicate_ids",
  );
});
