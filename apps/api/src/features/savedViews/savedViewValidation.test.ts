import assert from "node:assert/strict";
import { test } from "node:test";
import { HttpError } from "../../errors/httpError.js";
import {
  parseCreateSavedViewInput,
  parseSavedViewOrder,
  parseUpdateSavedViewInput,
} from "./savedViewValidation.js";

test("normalizes complete saved-view definitions", () => {
  assert.deepEqual(
    parseCreateSavedViewInput({
      name: "  PS5 plans  ",
      filters: {
        search: "  astro  ",
        platforms: ["PS5"],
        playStatuses: ["not_started", "playing"],
        hiddenMode: "visible",
        collectionIds: ["collection-one"],
      },
      sort: {
        field: "priorityRank",
        direction: "asc",
      },
    }),
    {
      name: "PS5 plans",
      filters: {
        search: "astro",
        platforms: ["PS5"],
        playStatuses: ["not_started", "playing"],
        hiddenMode: "visible",
        collectionIds: ["collection-one"],
      },
      sort: {
        field: "priorityRank",
        direction: "asc",
      },
    },
  );

  assert.deepEqual(
    parseUpdateSavedViewInput({
      name: "Renamed",
    }),
    {
      name: "Renamed",
    },
  );

  assert.deepEqual(
    parseSavedViewOrder({
      orderedViewIds: ["one", "two"],
    }),
    ["one", "two"],
  );
});

test("accepts planned trophy filters without inventing query results", () => {
  const input = parseCreateSavedViewInput({
    name: "Completion lost",
    filters: {
      platinumEarned: true,
      is100Percent: false,
      needsSync: true,
      alertKinds: ["completion_lost"],
      alertStatus: "unread",
    },
    sort: {
      field: "alertCreatedAt",
      direction: "desc",
    },
  });

  assert.equal(input.filters.needsSync, true);
  assert.equal(input.sort.field, "alertCreatedAt");
});

test("rejects unknown fields, duplicate values, and incomplete definitions", () => {
  for (const value of [
    {
      name: "Bad",
      filters: {
        platforms: ["PS5", "PS5"],
      },
      sort: {
        field: "title",
        direction: "asc",
      },
    },
    {
      name: "Bad",
      filters: {},
      sort: {
        field: "unknown",
        direction: "asc",
      },
    },
    {
      name: "Bad",
      filters: {},
      sort: {
        field: "title",
        direction: "asc",
      },
      extra: true,
    },
  ]) {
    assert.throws(
      () => parseCreateSavedViewInput(value),
      (error: unknown) =>
        error instanceof HttpError && error.statusCode === 400,
    );
  }

  assert.throws(
    () => parseUpdateSavedViewInput({}),
    (error: unknown) =>
      error instanceof HttpError && error.code === "empty_update",
  );

  assert.throws(
    () =>
      parseSavedViewOrder({
        orderedViewIds: ["one", "one"],
      }),
    (error: unknown) => error instanceof HttpError && error.statusCode === 400,
  );
});
