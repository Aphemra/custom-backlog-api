import assert from "node:assert/strict";
import { test } from "node:test";
import { parseIgdbGames, parseIgdbTimeToBeat } from "./igdbClient.js";

test("parses rich IGDB game metadata into a stable local contract", () => {
  const payload = {
    id: 250766,
    name: "Astro Bot",
    slug: "astro-bot",
    url: "https://www.igdb.com/games/astro-bot",
    summary: "A platforming adventure.",
    storyline: "Astro sets out on a new journey.",
    game_type: { id: 0, type: "Main Game" },
    platforms: [{ id: 48 }, { id: 167 }],
    release_dates: [
      { date: 1_725_580_800, platform: { id: 167 } },
      { date: 1_730_764_800, platform: { id: 48 } },
    ],
    cover: { image_id: "co8abc" },
    genres: [{ id: 8, name: "Platform" }],
    game_modes: [{ id: 1, name: "Single player" }],
    involved_companies: [
      {
        company: { id: 123, name: "Team Asobi" },
        developer: true,
        publisher: false,
      },
      {
        company: { id: 45, name: "Sony Interactive Entertainment" },
        developer: false,
        publisher: true,
      },
    ],
    collections: [{ id: 55, name: "Astro Bot" }],
    franchises: [{ id: 66, name: "Astro" }],
    screenshots: [{ image_id: "sc1", width: 1920, height: 1080 }],
    artworks: [{ image_id: "ar1", width: 1920, height: 1080 }],
    total_rating: 91.25,
    total_rating_count: 400,
    updated_at: 1_725_580_800,
  };

  const [game] = parseIgdbGames([payload]);

  assert.equal(game?.externalId, "250766");
  assert.equal(game?.title, "Astro Bot");
  assert.equal(game?.slug, "astro-bot");
  assert.equal(game?.igdbUrl, "https://www.igdb.com/games/astro-bot");
  assert.equal(game?.summary, "A platforming adventure.");
  assert.equal(game?.storyline, "Astro sets out on a new journey.");
  assert.deepEqual(game?.platforms, ["PS4", "PS5"]);
  assert.equal(game?.releaseDate, "2024-09-06");
  assert.deepEqual(game?.releases, [
    { platform: "PS5", releaseDate: "2024-09-06" },
    { platform: "PS4", releaseDate: "2024-11-05" },
  ]);
  assert.equal(game?.coverImageId, "co8abc");
  assert.deepEqual(game?.screenshots, [
    { imageId: "sc1", width: 1920, height: 1080 },
  ]);
  assert.deepEqual(game?.artworks, [
    { imageId: "ar1", width: 1920, height: 1080 },
  ]);
  assert.deepEqual(game?.genres, [{ externalId: "8", name: "Platform" }]);
  assert.deepEqual(game?.gameModes, [
    { externalId: "1", name: "Single player" },
  ]);
  assert.deepEqual(game?.companies, [
    {
      externalId: "123",
      name: "Team Asobi",
      developer: true,
      publisher: false,
    },
    {
      externalId: "45",
      name: "Sony Interactive Entertainment",
      developer: false,
      publisher: true,
    },
  ]);
  assert.deepEqual(game?.collections, [
    { externalId: "55", name: "Astro Bot" },
  ]);
  assert.deepEqual(game?.franchises, [{ externalId: "66", name: "Astro" }]);
  assert.deepEqual(game?.gameType, {
    externalId: "0",
    name: "Main Game",
  });
  assert.equal(game?.parentGameId, null);
  assert.equal(game?.versionTitle, null);
  assert.equal(game?.totalRating, 91.25);
  assert.equal(game?.totalRatingCount, 400);
  assert.equal(game?.timeToBeat, null);
  assert.equal(game?.providerUpdatedAt, "2024-09-06T00:00:00.000Z");
  assert.equal(game?.isDlc, false);
  assert.equal(game?.payload, payload);
});

test("defaults optional rich metadata without rejecting sparse IGDB games", () => {
  const game = parseIgdbGames([{ id: 1, name: "Sparse Game" }])[0];

  assert.deepEqual(game, {
    externalId: "1",
    title: "Sparse Game",
    slug: null,
    igdbUrl: null,
    summary: null,
    storyline: null,
    platforms: [],
    releaseDate: null,
    releases: [],
    coverImageId: null,
    screenshots: [],
    artworks: [],
    genres: [],
    gameModes: [],
    companies: [],
    collections: [],
    franchises: [],
    gameType: { externalId: "0", name: null },
    parentGameId: null,
    versionTitle: null,
    totalRating: null,
    totalRatingCount: 0,
    timeToBeat: null,
    providerUpdatedAt: null,
    isDlc: false,
    payload: { id: 1, name: "Sparse Game" },
  });
});

test("parses IGDB time-to-beat data and treats an empty result as unavailable", () => {
  assert.deepEqual(
    parseIgdbTimeToBeat([
      {
        game_id: 250766,
        hastily: 28_800,
        normally: 43_200,
        completely: 64_800,
        count: 125,
      },
    ]),
    {
      hastilySeconds: 28_800,
      normallySeconds: 43_200,
      completelySeconds: 64_800,
      submissionCount: 125,
    },
  );

  assert.equal(parseIgdbTimeToBeat([]), null);
});
