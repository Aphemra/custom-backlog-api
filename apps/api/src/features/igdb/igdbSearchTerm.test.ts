import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeIgdbSearchTerm } from "./igdbSearchTerm.js";

test("normalizes symbols and full-width title characters", () => {
  assert.equal(
    normalizeIgdbSearchTerm("Danganronpa １・２ Reload®"),
    "Danganronpa 1 2 Reload",
  );

  assert.equal(
    normalizeIgdbSearchTerm("Zero Escape: The Nonary Games™"),
    "Zero Escape The Nonary Games",
  );
});

test("removes trophy-list suffixes without damaging the title", () => {
  assert.equal(
    normalizeIgdbSearchTerm("Phoenix Wright: Ace Attorney Trilogy Trophy List"),
    "Phoenix Wright Ace Attorney Trilogy",
  );

  assert.equal(
    normalizeIgdbSearchTerm("Example Game - Trophies"),
    "Example Game",
  );

  assert.equal(normalizeIgdbSearchTerm("Trophy Hunter"), "Trophy Hunter");
});
