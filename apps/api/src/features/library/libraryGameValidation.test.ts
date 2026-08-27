import assert from "node:assert/strict";
import { test } from "node:test";
import { HttpError } from "../../errors/httpError.js";
import {
  parseCreateLibraryGameInput,
  parseLibraryGameOrder,
  parseUpdateLibraryGameInput,
} from "./libraryGameValidation.js";

test("normalizes valid create and update input", () => {
  assert.deepEqual(
    parseCreateLibraryGameInput({
      title: "  Astro Bot  ",
      platform: "PS5",
      playStatus: "playing",
      isUnobtainable: false,
      notes: "  Excellent platformer.  ",
    }),
    {
      title: "Astro Bot",
      platform: "PS5",
      playStatus: "playing",
      isUnobtainable: false,
      notes: "Excellent platformer.",
    },
  );

  assert.deepEqual(
    parseUpdateLibraryGameInput({
      notes: "   ",
    }),
    {
      notes: null,
    },
  );
});

test("rejects unsupported platforms, unknown fields, and duplicate reorder IDs", () => {
  assert.throws(
    () =>
      parseCreateLibraryGameInput({
        title: "Example",
        platform: "Vita",
      }),
    (error: unknown) =>
      error instanceof HttpError && error.code === "invalid_platform",
  );

  assert.throws(
    () =>
      parseUpdateLibraryGameInput({
        trophyGuideUrl: "https://example.com",
      }),
    (error: unknown) =>
      error instanceof HttpError && error.code === "unknown_fields",
  );

  assert.throws(
    () =>
      parseLibraryGameOrder({
        orderedGameIds: ["game-1", "game-1"],
      }),
    (error: unknown) =>
      error instanceof HttpError && error.code === "duplicate_game_ids",
  );

  assert.throws(
    () =>
      parseUpdateLibraryGameInput({
        playStatus: "playing",
        pursuitStatus: "in_progress",
      }),
    (error: unknown) =>
      error instanceof HttpError && error.code === "conflicting_status_fields",
  );

  assert.throws(
    () =>
      parseUpdateLibraryGameInput({
        isUnobtainable: "yes",
      }),
    (error: unknown) =>
      error instanceof HttpError && error.code === "invalid_isUnobtainable",
  );
});
