import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { createApp } from "../app.js";
import { openDatabase } from "../database/database.js";
import { LibraryGameRepository } from "../features/library/libraryGameRepository.js";
import type { GameResource } from "../features/resources/gameResourceTypes.js";

interface ResourceResponse {
  resource: GameResource;
}

interface ResourcesResponse {
  resources: GameResource[];
}

async function closeServer(
  server: ReturnType<ReturnType<typeof createApp>["listen"]>,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) {
        resolve();
        return;
      }

      reject(error);
    });
  });
}

test("exposes ordered game-resource CRUD through the Library API", async () => {
  const database = openDatabase(":memory:");

  const game = new LibraryGameRepository(database).create({
    title: "Astro Bot",
    platform: "PS5",
  });

  const server = createApp(database).listen(0, "127.0.0.1");

  try {
    await once(server, "listening");

    const address = server.address() as AddressInfo;

    const baseUrl =
      `http://127.0.0.1:${address.port}` +
      `/api/library/games/${game.id}/resources`;

    const trophyPageResponse = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        resourceType: "trophy_page",
        url: "https://psnprofiles.com/trophies/12345-astro-bot",
      }),
    });

    assert.equal(trophyPageResponse.status, 201);

    const trophyPage = (await trophyPageResponse.json()) as ResourceResponse;

    assert.equal(
      trophyPageResponse.headers.get("location"),
      `/api/library/games/${game.id}/resources/${trophyPage.resource.id}`,
    );

    assert.equal(trophyPage.resource.provider, "psnprofiles");

    const guideResponse = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        resourceType: "guide",
        url: "https://www.powerpyx.com/astro-bot-trophy-guide-roadmap/",
        label: "PowerPyx guide",
      }),
    });

    assert.equal(guideResponse.status, 201);

    const guide = (await guideResponse.json()) as ResourceResponse;

    assert.equal(guide.resource.provider, "powerpyx");

    const listResponse = await fetch(baseUrl);

    assert.equal(listResponse.status, 200);

    const listed = (await listResponse.json()) as ResourcesResponse;

    assert.deepEqual(
      listed.resources.map((resource) => resource.id),
      [trophyPage.resource.id, guide.resource.id],
    );

    const updateResponse = await fetch(`${baseUrl}/${guide.resource.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        url: "https://psnprofiles.com/guide/12345-astro-bot-trophy-guide",
        label: "PSNProfiles guide",
      }),
    });

    assert.equal(updateResponse.status, 200);

    const updatedGuide = (await updateResponse.json()) as ResourceResponse;

    assert.equal(updatedGuide.resource.provider, "psnprofiles");

    assert.equal(updatedGuide.resource.label, "PSNProfiles guide");

    const reorderResponse = await fetch(`${baseUrl}/order`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        orderedResourceIds: [guide.resource.id, trophyPage.resource.id],
      }),
    });

    assert.equal(reorderResponse.status, 200);

    const reordered = (await reorderResponse.json()) as ResourcesResponse;

    assert.deepEqual(
      reordered.resources.map((resource) => ({
        id: resource.id,
        sortOrder: resource.sortOrder,
      })),
      [
        {
          id: guide.resource.id,
          sortOrder: 1_000,
        },
        {
          id: trophyPage.resource.id,
          sortOrder: 2_000,
        },
      ],
    );

    const incompleteOrderResponse = await fetch(`${baseUrl}/order`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        orderedResourceIds: [guide.resource.id],
      }),
    });

    assert.equal(incompleteOrderResponse.status, 409);

    const duplicateTrophyPageResponse = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        resourceType: "trophy_page",
        url: "https://psnprofiles.com/trophies/67890-astro-bot",
      }),
    });

    assert.equal(duplicateTrophyPageResponse.status, 409);

    assert.deepEqual(await duplicateTrophyPageResponse.json(), {
      ok: false,
      error: "trophy_page_already_exists",
      message: "This game already has an exact PSNProfiles trophy-page URL.",
    });

    const unsafeResponse = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        resourceType: "guide",
        url: "javascript:alert('nope')",
      }),
    });

    assert.equal(unsafeResponse.status, 400);

    const deleteResponse = await fetch(`${baseUrl}/${trophyPage.resource.id}`, {
      method: "DELETE",
    });

    assert.equal(deleteResponse.status, 204);

    const missingResourceResponse = await fetch(`${baseUrl}/missing-resource`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        label: "Missing",
      }),
    });

    assert.equal(missingResourceResponse.status, 404);

    const missingGameResponse = await fetch(
      `http://127.0.0.1:${address.port}` +
        "/api/library/games/missing-game/resources",
    );

    assert.equal(missingGameResponse.status, 404);
  } finally {
    await closeServer(server);
    database.close();
  }
});
