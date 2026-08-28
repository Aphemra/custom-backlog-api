import assert from "node:assert/strict";
import { test } from "node:test";
import { HttpError } from "../../errors/httpError.js";
import {
  parseCreateGameResourceInput,
  parseGameResourceOrder,
  parseUpdateGameResourceInput,
  resolveGameResourceTarget,
} from "./gameResourceValidation.js";

test("normalizes resources and detects trusted providers", () => {
  assert.deepEqual(
    parseCreateGameResourceInput({
      resourceType: "trophy_page",
      url: "  HTTPS://www.PSNProfiles.com/trophies/12345-astro-bot  ",
      label: "  Trophy list  ",
    }),
    {
      resourceType: "trophy_page",
      provider: "psnprofiles",
      url: "https://www.psnprofiles.com/trophies/12345-astro-bot",
      label: "Trophy list",
    },
  );

  assert.deepEqual(
    parseCreateGameResourceInput({
      resourceType: "guide",
      url: "https://www.powerpyx.com/astro-bot-trophy-guide-roadmap/",
    }),
    {
      resourceType: "guide",
      provider: "powerpyx",
      url: "https://www.powerpyx.com/astro-bot-trophy-guide-roadmap/",
    },
  );

  assert.deepEqual(
    parseCreateGameResourceInput({
      resourceType: "guide",
      url: "https://example.com/guides/astro-bot",
      label: "  Other guide  ",
    }),
    {
      resourceType: "guide",
      provider: "other",
      url: "https://example.com/guides/astro-bot",
      label: "Other guide",
    },
  );

  assert.deepEqual(
    resolveGameResourceTarget(
      "interactive_map",
      "https://mapgenie.io/astro-bot/maps/example",
    ),
    {
      resourceType: "interactive_map",
      provider: "mapgenie",
      url: "https://mapgenie.io/astro-bot/maps/example",
    },
  );

  assert.deepEqual(
    parseUpdateGameResourceInput({
      url: "  https://example.com/new-guide  ",
      label: "   ",
    }),
    {
      url: "https://example.com/new-guide",
      label: null,
    },
  );

  assert.deepEqual(
    parseGameResourceOrder({
      orderedResourceIds: [" trophy-page ", "guide-one", "map-one"],
    }),
    ["trophy-page", "guide-one", "map-one"],
  );
});

test("rejects unsafe URLs, incompatible providers, and malformed input", () => {
  assert.throws(
    () =>
      parseCreateGameResourceInput({
        resourceType: "guide",
        url: "http://example.com/guide",
      }),
    (error: unknown) =>
      error instanceof HttpError && error.code === "invalid_resource_url",
  );

  assert.throws(
    () =>
      parseCreateGameResourceInput({
        resourceType: "guide",
        url: "https://user:password@example.com/guide",
      }),
    (error: unknown) =>
      error instanceof HttpError && error.code === "invalid_resource_url",
  );

  assert.throws(
    () =>
      parseCreateGameResourceInput({
        resourceType: "trophy_page",
        url: "https://psnprofiles.com.evil.example/trophies/12345-astro-bot",
      }),
    (error: unknown) =>
      error instanceof HttpError && error.code === "resource_provider_mismatch",
  );

  assert.throws(
    () =>
      parseCreateGameResourceInput({
        resourceType: "trophy_page",
        url: "https://psnprofiles.com/search/games?q=astro",
      }),
    (error: unknown) =>
      error instanceof HttpError && error.code === "invalid_trophy_page_url",
  );

  assert.throws(
    () =>
      parseCreateGameResourceInput({
        resourceType: "guide",
        url: "https://psnprofiles.com/trophies/12345-astro-bot",
      }),
    (error: unknown) =>
      error instanceof HttpError && error.code === "invalid_guide_url",
  );

  assert.throws(
    () =>
      parseCreateGameResourceInput({
        resourceType: "guide",
        url: "https://mapgenie.io/astro-bot/maps/example",
      }),
    (error: unknown) =>
      error instanceof HttpError && error.code === "resource_provider_mismatch",
  );

  assert.throws(
    () =>
      parseCreateGameResourceInput({
        resourceType: "interactive_map",
        url: "https://www.powerpyx.com/astro-bot-trophy-guide-roadmap/",
      }),
    (error: unknown) =>
      error instanceof HttpError && error.code === "resource_provider_mismatch",
  );

  assert.throws(
    () =>
      parseCreateGameResourceInput({
        resourceType: "guide",
        url: "https://example.com/guide",
        provider: "other",
      }),
    (error: unknown) =>
      error instanceof HttpError && error.code === "unknown_fields",
  );

  assert.throws(
    () =>
      parseCreateGameResourceInput({
        resourceType: "walkthrough",
        url: "https://example.com/guide",
      }),
    (error: unknown) =>
      error instanceof HttpError && error.code === "invalid_resource_type",
  );

  assert.throws(
    () =>
      parseCreateGameResourceInput({
        resourceType: "guide",
        url: "https://example.com/guide",
        label: "x".repeat(101),
      }),
    (error: unknown) =>
      error instanceof HttpError && error.code === "invalid_resource_label",
  );

  assert.throws(
    () => parseUpdateGameResourceInput({}),
    (error: unknown) =>
      error instanceof HttpError && error.code === "empty_update",
  );

  assert.throws(
    () =>
      parseGameResourceOrder({
        orderedResourceIds: ["guide-one", "guide-one"],
      }),
    (error: unknown) =>
      error instanceof HttpError && error.code === "duplicate_resource_ids",
  );

  assert.throws(
    () =>
      parseGameResourceOrder({
        orderedResourceIds: ["guide-one"],
        gameId: "not-accepted-here",
      }),
    (error: unknown) =>
      error instanceof HttpError && error.code === "unknown_fields",
  );
});
